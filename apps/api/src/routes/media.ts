import { visibleLesson } from '../lib/lessons.js';
import { enrollmentActive } from '../lib/enrollment.js';
import express, { Router, type Request } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rm, writeFile, type FileHandle } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, fail } from '../lib/http.js';
import { requireAuth, requirePlatform } from '../middleware/auth.js';

const router = Router();
const storage = () => resolve(process.env.LOCAL_STORAGE_PATH || '.local-storage');
const pptMime = 'application/vnd.ms-powerpoint';
const pptxMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const metaSchema = z.object({ courseId: z.string().uuid(), mime: z.enum(['application/pdf', 'video/mp4', 'video/webm', 'image/png', 'image/jpeg', pptMime, pptxMime]) });
function validSignature(data: Buffer, mime: string) {
  if (mime === pptMime) return data.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (mime === pptxMime) return data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && data.includes('ppt/presentation.xml');
  if (mime === 'application/pdf') return data.subarray(0, 5).toString() === '%PDF-';
  if (mime === 'video/mp4') return data.subarray(4, 8).toString() === 'ftyp';
  if (mime === 'video/webm') return data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mime === 'image/png') return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/jpeg') return data.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  return false;
}
const maxVideoBytes = 500 * 1024 * 1024;
const isVideo = (mime: string) => mime === 'video/mp4' || mime === 'video/webm';

async function writeVideo(req: Request, file: FileHandle, mime: string) {
  const signatureLength = mime === 'video/mp4' ? 8 : 4;
  const signature = Buffer.alloc(signatureLength);
  let bytes = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false }) as AsyncIterable<Buffer>) {
    if (bytes + chunk.length > maxVideoBytes) fail(413, 'FILE_TOO_LARGE', 'Video files can be up to 500 MB.');
    if (bytes < signatureLength) {
      chunk.copy(signature, bytes, 0, signatureLength - bytes);
      if (bytes + chunk.length >= signatureLength && !validSignature(signature, mime)) {
        fail(422, 'INVALID_FILE', 'Upload a valid MP4 or WebM video.');
      }
    }
    await file.writeFile(chunk);
    bytes += chunk.length;
  }
  if (bytes < signatureLength) fail(422, 'INVALID_FILE', 'Upload a valid MP4 or WebM video.');
  return bytes;
}

router.post('/courses/:courseId', requireAuth, requirePlatform,
  express.raw({ type: ['application/pdf', 'image/png', 'image/jpeg', pptMime, pptxMime], limit: '50mb' }),
  asyncRoute(async (req, res) => {
    if (process.env.NODE_ENV === 'production') fail(503, 'STORAGE_UNCONFIGURED', 'Production file storage is not configured.');
    const courseId = z.string().uuid().parse(req.params.courseId);
    const course = await prisma.course.findFirst({ where: { id: courseId, tenantId: null } });
    if (!course) fail(404, 'COURSE_NOT_FOUND', 'Course not found.');
    const mime = req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() || '';
    const video = isVideo(mime);
    if (video) {
      if (Number(req.header('Content-Length')) > maxVideoBytes) fail(413, 'FILE_TOO_LARGE', 'Video files can be up to 500 MB.');
    } else if (!Buffer.isBuffer(req.body) || !validSignature(req.body, mime)) {
      fail(422, 'INVALID_FILE', 'Upload a valid PDF, PPT, PPTX, MP4, WebM, PNG or JPEG file.');
    }

    const assetId = randomUUID();
    const directory = storage();
    const assetPath = resolve(directory, `${assetId}.bin`);
    const metaPath = resolve(directory, `${assetId}.json`);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const file = await open(assetPath, 'wx', 0o600);
    let metadataWritten = false;
    try {
      let bytes: number;
      try {
        if (video) bytes = await writeVideo(req, file, mime);
        else {
          await file.writeFile(req.body);
          bytes = req.body.length;
        }
      } finally {
        await file.close();
      }
      await writeFile(metaPath, JSON.stringify({ courseId, mime }), { mode: 0o600, flag: 'wx' });
      metadataWritten = true;
      await prisma.auditLog.create({ data: { actorId: req.auth!.userId, action: 'COURSE_FILE_UPLOADED', entityType: 'Course', entityId: courseId, metadata: { assetId, mime, bytes } } });
    } catch (error) {
      req.resume();
      await rm(assetPath, { force: true });
      if (metadataWritten) await rm(metaPath, { force: true });
      throw error;
    }
    const origin = process.env.API_ORIGIN || 'http://localhost:4000';
    res.status(201).json({ data: { url: `${origin}/api/v1/media/${assetId}`, mime } });
  }));
router.get('/:id', asyncRoute(async (req, res) => {
  const assetId = z.string().uuid().parse(req.params.id);
  let meta: z.infer<typeof metaSchema>;
  try { meta = metaSchema.parse(JSON.parse(await readFile(resolve(storage(), `${assetId}.json`), 'utf8'))); }
  catch { fail(404, 'FILE_NOT_FOUND', 'File not found.'); }
  const url = `${process.env.API_ORIGIN || 'http://localhost:4000'}/api/v1/media/${assetId}`;
  const course = await prisma.course.findFirst({ where: { id: meta.courseId, tenantId: null },
    select: { status: true, thumbnailUrl: true, lessons: {
      where: { ...visibleLesson, OR: [{ contentUrl: url }, { resources: { some: { url } } }] }, select: { isPreview: true },
    } } });
  if (!course) fail(404, 'FILE_NOT_FOUND', 'File not found.');
  const isAdmin = req.auth?.platformRole === 'SUPER_ADMIN' && !req.auth.tenantId;
  const attached = course.lessons.length > 0;
  const isPublic = course.status === 'PUBLISHED' && (
    (meta.mime.startsWith('image/') && course.thumbnailUrl === url) || course.lessons.some(lesson => lesson.isPreview)
  );
  let enrolled = false;
  if (!isAdmin && !isPublic && attached && req.auth && !req.auth.tenantId) {
    const enrollment = await prisma.directEnrollment.findUnique({ where: { userId_courseId: { userId: req.auth.userId, courseId: meta.courseId } } });
    enrolled = enrollmentActive(enrollment);
  }
  if (!isAdmin && !isPublic && !enrolled) fail(403, 'ACCESS_REQUIRED', 'Active course access is required.');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Content-Type', meta.mime);
  const extension = meta.mime === pptMime ? 'ppt' : meta.mime === pptxMime ? 'pptx' : meta.mime === 'application/pdf' ? 'pdf' : null;
  res.setHeader('Content-Disposition', extension ? `attachment; filename="course-resource.${extension}"` : 'inline');
  res.sendFile(resolve(storage(), `${assetId}.bin`));
}));
export default router;
