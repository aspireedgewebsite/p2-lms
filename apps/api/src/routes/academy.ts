import { lessonOrder, resourceOrder, visibleLesson } from '../lib/lessons.js';
import { CourseTrack, LessonResourceKind, Prisma } from '@prisma/client';
import { razorpayCheckoutKey, razorpayConfig, razorpayPrice } from '../lib/razorpay.js';
import { registerSchema, registerStudent, studentDetails } from '../lib/student-registration.js';
import { studentPhoneKey } from '../lib/student-phone.js';
import { enrollmentActive, enrollmentStatus } from '../lib/enrollment.js';
import analyticsRoutes from './analytics.js';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, fail, pageInput, sendList } from '../lib/http.js';
import { requireAuth, requirePlatform, requireStudent } from '../middleware/auth.js';

const router = Router();
const id = z.string().uuid();
const courseInput = z.object({
  title: z.string().trim().min(3).max(180),
  instructor: z.string().trim().max(120).optional().nullable(),
  learningObjectives: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
  description: z.string().trim().max(10000).optional().nullable(),
  previewText: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  track: z.nativeEnum(CourseTrack).optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
  pricePaise: z.number().int().min(0).max(100000000),
  durationHours: z.number().int().positive().max(10000).optional().nullable(),
  thumbnailUrl: z.string().url().max(2000).refine(v => /^https?:\/\//i.test(v), 'Use an HTTP or HTTPS URL').optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
});
const resourceUrl = z.string().url().max(2000).refine(v => /^https?:\/\//i.test(v), 'Use an HTTP or HTTPS URL');
const lessonInput = z.object({
  title: z.string().trim().min(2).max(180),
  kind: z.enum(['TEXT', 'VIDEO', 'LINK', 'PDF']).default('TEXT'),
  content: z.string().max(25000).optional().nullable(),
  contentUrl: resourceUrl.optional().nullable(),
  published: z.boolean().optional(),
  isPreview: z.boolean().default(false),
  position: z.number().int().min(0).max(10000).default(0),
});
const grantInput = z.object({
  expiresAt: z.string().datetime().refine(v => new Date(v) > new Date(), 'Expiry must be in the future').nullable().optional(),
  studentCode: z.string().trim().min(4).max(254).transform(s => s.toUpperCase()),
  courseId: id,
  source: z.enum(['MANUAL_PAYMENT', 'COMPLIMENTARY']),
  paymentMethod: z.enum(['UPI', 'BANK_TRANSFER', 'CASH', 'OTHER']).optional(),
  paymentReference: z.string().trim().max(150).optional(),
  amountPaise: z.number().int().min(0).max(100000000).optional(),
  note: z.string().trim().max(1000).optional(),
}).superRefine((v, ctx) => {
  if (v.source === 'MANUAL_PAYMENT' && (!v.paymentMethod || v.amountPaise === undefined)) {
    ctx.addIssue({ code: 'custom', path: ['paymentMethod'], message: 'Payment method and amount required for manual payment.' });
  }
});
const publicCourse = { id: true, title: true, description: true, previewText: true, category: true, track: true,
  instructor: true, learningObjectives: true, level: true, pricePaise: true, durationHours: true, thumbnailUrl: true, status: true } as const;
const lessonOutline = { id: true, title: true, kind: true, position: true, isPreview: true } as const;

// Public catalog and course syllabus. Premium lesson content is not included in this response.
router.get('/categories', asyncRoute(async (_req, res) => {
  const courses = await prisma.course.findMany({ where: { tenantId: null, status: 'PUBLISHED', category: { not: null } }, select: { category: true }, distinct: ['category'], orderBy: { category: 'asc' } });
  res.json({ data: courses.map(c => c.category).filter(Boolean) });
}));
router.get('/courses', asyncRoute(async (req, res) => {
  const { page, pageSize, skip, q } = pageInput(req.query);
  const category = typeof req.query.category === 'string' ? req.query.category.slice(0, 80) : '';
  const track = z.nativeEnum(CourseTrack).optional().parse(req.query.track);
  const where = { tenantId: null, status: 'PUBLISHED' as const, ...(track ? { track } : {}), ...(category ? { category } : {}), ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' as const } }, { description: { contains: q, mode: 'insensitive' as const } }] } : {}) };
  const [total, courses] = await prisma.$transaction([
    prisma.course.count({ where }),
    prisma.course.findMany({ where, select: publicCourse, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: pageSize }),
  ]);
  sendList(res, courses, total, page, pageSize);
}));
router.get('/courses/:id', asyncRoute(async (req, res) => {
  const courseId = id.parse(req.params.id);
  const course = await prisma.course.findFirst({ where: { id: courseId, tenantId: null, status: 'PUBLISHED' },
    select: { ...publicCourse, lessons: { where: visibleLesson, orderBy: lessonOrder, select: lessonOutline } } });
  if (!course) fail(404, 'COURSE_NOT_FOUND', 'Course not found.');
  const auth = req.auth;
  const enrollment = auth && !auth.tenantId && auth.platformRole !== 'SUPER_ADMIN'
    ? await prisma.directEnrollment.findUnique({ where: { userId_courseId: { userId: auth.userId, courseId } },
      select: { status: true, expiresAt: true } })
    : null;
  const hasAccess = enrollmentActive(enrollment);
  const config = razorpayConfig();
  const price = razorpayPrice(course.pricePaise);
  const pending = config && req.auth && !hasAccess && course.pricePaise > 0
    ? await prisma.courseOrder.findUnique({
      where: { checkoutKey: razorpayCheckoutKey(config.key, req.auth.userId, courseId) },
      select: { amountPaise: true },
    })
    : null;
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ data: { ...course, hasAccess, onlineCheckout: Boolean(config), razorpayQuote: {
    totalPaise: pending?.amountPaise ?? price.totalPaise,
    surchargePaise: pending && pending.amountPaise !== price.totalPaise ? null : price.surchargePaise,
  } } });
}));
router.get('/courses/:id/preview/:lessonId', asyncRoute(async (req, res) => {
  const courseId = id.parse(req.params.id);
  const lesson = await prisma.lesson.findFirst({ where: { id: id.parse(req.params.lessonId), isPreview: true, ...visibleLesson, courseId, course: { tenantId: null, status: 'PUBLISHED' } },
    select: { id: true, title: true, kind: true, content: true, contentUrl: true, resources: { orderBy: resourceOrder } } });
  if (!lesson) fail(404, 'PREVIEW_NOT_FOUND', 'Preview is unavailable.');
  res.json({ data: lesson });
}));

router.use(requireAuth);

// Student-only queries. Every access to course content is gated by active enrollment.
router.get('/student/dashboard', requireStudent, asyncRoute(async (req, res) => {
  const userId = req.auth!.userId;
  const [student, enrollments, orders] = await Promise.all([
    prisma.studentAccount.findUniqueOrThrow({ where: { userId }, select: { studentCode: true } }),
    prisma.directEnrollment.findMany({ where: { userId }, include: { course: { select: { id: true, title: true, thumbnailUrl: true, status: true, track: true, lessons: { where: visibleLesson, select: { id: true } } } }, progress: { select: { lessonId: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.courseOrder.count({ where: { userId, status: 'PENDING' } }),
  ]);
  const courses = enrollments.map(e => {
    const totalLessons = e.course.lessons.length;
    const visibleIds = new Set(e.course.lessons.map(l => l.id));
    const completedLessons = e.progress.filter(p => visibleIds.has(p.lessonId)).length;
    return { id: e.course.id, title: e.course.title, thumbnailUrl: e.course.thumbnailUrl, track: e.course.track, accessStatus: enrollmentStatus(e),
      source: e.source, lastActivityAt: e.lastActivityAt, enrolledAt: e.createdAt, totalLessons, completedLessons,
      progressPercent: totalLessons ? Math.min(100, Math.round(completedLessons / totalLessons * 100)) : 0 };
  });
  res.json({ data: { studentCode: student.studentCode, courses, pendingOrders: orders,
    activeCourses: courses.filter(c => c.accessStatus === 'ACTIVE').length,
    completedCourses: courses.filter(c => c.accessStatus === 'ACTIVE' && c.totalLessons > 0 && c.completedLessons === c.totalLessons).length } });
}));
router.get('/student/courses/:id', requireStudent, asyncRoute(async (req, res) => {
  const courseId = id.parse(req.params.id);
  const enrollment = await prisma.directEnrollment.findUnique({ where: { userId_courseId: { userId: req.auth!.userId, courseId } },
    include: { progress: { select: { lessonId: true, completedAt: true } } } });
  if (!enrollment || !enrollmentActive(enrollment)) fail(403, 'ACCESS_REQUIRED', 'You do not have access to this course.');
  const course = await prisma.course.findFirst({ where: { id: courseId, tenantId: null }, include: {
    lessons: { where: visibleLesson, orderBy: lessonOrder, omit: { legacyModuleId: true }, include: { resources: { orderBy: resourceOrder } } },
  } });
  if (!course) fail(404, 'COURSE_NOT_FOUND', 'Course no longer exists.');
  res.json({ data: { course: { id: course.id, title: course.title, description: course.description, lessons: course.lessons }, lastLessonId: enrollment.lastLessonId, progress: enrollment.progress.filter(p => course.lessons.some(l => l.id === p.lessonId)) } });
}));
router.post(['/student/lessons/:id/complete', '/student/lessons/:id/visit'], requireStudent, asyncRoute(async (req, res) => {
  const lessonId = id.parse(req.params.id);
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, ...visibleLesson, course: { tenantId: null } }, select: { courseId: true } });
  if (!lesson) fail(404, 'LESSON_NOT_FOUND', 'Lesson not found.');
  const enrollment = await prisma.directEnrollment.findUnique({ where: { userId_courseId: { userId: req.auth!.userId, courseId: lesson.courseId } } });
  if (!enrollment || !enrollmentActive(enrollment)) fail(403, 'ACCESS_REQUIRED', 'You do not have access to this lesson.');
  await prisma.$transaction(async tx => {
  await tx.directEnrollment.update({ where: { id: enrollment.id }, data: { lastActivityAt: new Date(), lastLessonId: lessonId } });
  if (req.path.endsWith('/complete')) await tx.lessonProgress.upsert({ where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } }, update: {}, create: { enrollmentId: enrollment.id, lessonId } });
  });
  res.json({ data: { completed: req.path.endsWith('/complete') } });
}));
router.post('/student/courses/:id/enroll-free', requireStudent, asyncRoute(async (req, res) => {
  const courseId = id.parse(req.params.id);
  const userId = req.auth!.userId;
  const course = await prisma.course.findFirst({ where: { id: courseId, tenantId: null, status: 'PUBLISHED', pricePaise: 0 } });
  if (!course) fail(404, 'FREE_COURSE_NOT_FOUND', 'Free course unavailable.');
  const enrollment = await prisma.$transaction(async tx => {
    const current = await tx.directEnrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (current && enrollmentActive(current)) return current;
    const record = await tx.directEnrollment.upsert({ where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, source: 'COMPLIMENTARY', status: 'ACTIVE', note: 'Free course enrollment' },
      update: { expiresAt: null, status: 'ACTIVE', source: 'COMPLIMENTARY', revokedAt: null, note: 'Free course enrollment' } });
    await tx.auditLog.create({ data: { actorId: userId, action: 'FREE_COURSE_ENROLL', entityType: 'DirectEnrollment', entityId: record.id } });
    return record;
  });
  res.json({ data: { enrollmentId: enrollment.id, status: enrollment.status } });
}));
router.get('/student/orders', requireStudent, asyncRoute(async (req, res) => {
  const orders = await prisma.courseOrder.findMany({ where: { userId: req.auth!.userId },
    include: { course: { select: { title: true } } }, orderBy: { createdAt: 'desc' } });
  res.json({ data: orders });
}));
// Purchase request does NOT grant access: admin must independently verify funds received.
router.post('/student/orders', requireStudent, asyncRoute(async (req, res) => {
  const { courseId, paymentMethod, paymentReference } = z.object({ courseId: id,
    paymentMethod: z.enum(['UPI', 'CASH']),
    paymentReference: z.string().trim().max(150).optional(),
  }).refine(order => order.paymentMethod !== 'UPI' || Boolean(order.paymentReference), {
    path: ['paymentReference'], message: 'Enter the UPI transaction ID.',
  }).parse(req.body);
  const userId = req.auth!.userId;
  const course = await prisma.course.findFirst({ where: { id: courseId, tenantId: null, status: 'PUBLISHED' } });
  if (!course) fail(404, 'COURSE_NOT_FOUND', 'Course not found.');
  if (await prisma.directEnrollment.findFirst({ where: { userId, courseId, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } })) fail(409, 'ALREADY_ENROLLED', 'You already have access to this course.');
  const pending = await prisma.courseOrder.findFirst({ where: { userId, courseId, status: 'PENDING', OR: [{ paymentMethod: null }, { paymentMethod: { not: 'RAZORPAY' } }] }, orderBy: { createdAt: 'desc' } });
  if (pending) fail(409, 'ORDER_PENDING', 'A purchase request is already awaiting review.');
  const order = await prisma.courseOrder.create({ data: { userId, courseId, amountPaise: course.pricePaise, paymentMethod, paymentReference, status: 'PENDING' } });
  res.status(201).json({ data: { id: order.id, status: order.status, message: 'Purchase request submitted. Admin will verify payment before access is enabled.' } });
}));

router.use('/admin', requirePlatform);
router.use('/admin', analyticsRoutes);
router.get('/admin/dashboard', asyncRoute(async (_req, res) => {
  const [students, courses, publishedCourses, activeEnrollments, manualEnrollments, pendingOrders, paidOrders, trackCounts] = await Promise.all([
    prisma.studentAccount.count({ where: { status: { not: 'ARCHIVED' } } }), prisma.course.count({ where: { tenantId: null } }),
    prisma.course.count({ where: { tenantId: null, status: 'PUBLISHED' } }),
    prisma.directEnrollment.count({ where: { status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], course: { tenantId: null } } }),
    prisma.directEnrollment.count({ where: { status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], source: 'MANUAL_PAYMENT', course: { tenantId: null } } }),
    prisma.courseOrder.count({ where: { status: 'PENDING', course: { tenantId: null } } }),
    prisma.courseOrder.aggregate({ where: { status: 'PAID', course: { tenantId: null } }, _sum: { amountPaise: true }, _count: true }),
    prisma.course.groupBy({ by: ['track', 'status'], where: { tenantId: null }, _count: true }),
  ]);
  const tracks = Object.values(CourseTrack).map(track => {
    const records = trackCounts.filter(row => row.track === track);
    const count = (status: string) => records.find(row => row.status === status)?._count ?? 0;
    return { track, courses: records.reduce((total, row) => total + row._count, 0),
      published: count('PUBLISHED'), draft: count('DRAFT'), archived: count('ARCHIVED') };
  });
  res.json({ data: { students, courses, publishedCourses, activeEnrollments, manualEnrollments, pendingOrders,
    recordedRevenuePaise: paidOrders._sum.amountPaise || 0, recordedPayments: paidOrders._count, tracks } });
}));
router.get('/admin/students', asyncRoute(async (req, res) => {
  const { page, pageSize, skip, q } = pageInput(req.query);
  const archived = z.enum(['true', 'false']).default('false').parse(req.query.archived);
  const where: Prisma.StudentAccountWhereInput = {
    status: archived === 'true' ? 'ARCHIVED' : { not: 'ARCHIVED' },
    ...(q ? { OR: [{ phone: { contains: q } }, { studentCode: { contains: q, mode: 'insensitive' as const } }, { user: { OR: [
    { email: { contains: q, mode: 'insensitive' as const } }, { name: { contains: q, mode: 'insensitive' as const } },
  ] } }] } : {}),
  };
  const [total, students] = await prisma.$transaction([
    prisma.studentAccount.count({ where }), prisma.studentAccount.findMany({ where, skip, take: pageSize,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { user: { select: { id: true, name: true, email: true, emailVerifiedAt: true,
        directEnrollments: { where: { course: { tenantId: null } }, include: { course: { select: { title: true, lessons: { where: visibleLesson, select: { id: true } } } }, progress: { select: { lessonId: true } } } } } } } }),
  ]);
  sendList(res, students.map(s => ({ id: s.id, userId: s.userId, studentCode: s.studentCode, status: s.status,
    name: s.user.name, email: s.user.email, emailVerified: Boolean(s.user.emailVerifiedAt), phone: s.phone, gender: s.gender, enrolledCourses: s.user.directEnrollments.map(e => {
      const lessonCount = e.course.lessons.length;
      const visibleIds = new Set(e.course.lessons.map(l => l.id));
      const completed = e.progress.filter(p => visibleIds.has(p.lessonId)).length;
      return { id: e.id, title: e.course.title, status: enrollmentStatus(e), expiresAt: e.expiresAt, source: e.source,
        completed, total: lessonCount, progressPercent: lessonCount ? Math.round(completed / lessonCount * 100) : 0 };
    }) })), total, page, pageSize);
}));
router.post('/admin/students', asyncRoute(async (req, res) => {
  const student = await registerStudent(registerSchema.parse(req.body), req.auth!.userId);
  res.status(201).json({ data: student });
}));

const studentUpdate = studentDetails.partial().extend({
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
}).refine(value => Object.keys(value).length > 0, 'Provide at least one change.');

async function updateStudent(studentId: string, actorId: string, data: z.infer<typeof studentUpdate> | { status: 'ARCHIVED' }) {
  return prisma.$transaction(async tx => {
    const student = await tx.studentAccount.findUnique({
      where: { id: studentId }, include: { user: { select: { email: true } } },
    });
    if (!student) fail(404, 'STUDENT_NOT_FOUND', 'Student account not found.');
    const details = 'status' in data && data.status === 'ARCHIVED' ? {} : data as z.infer<typeof studentUpdate>;
    const phoneKey = details.phone === undefined ? undefined : studentPhoneKey(details.phone);
    if (phoneKey && phoneKey !== student.phoneKey && await tx.studentAccount.findFirst({
      where: { phoneKey, id: { not: studentId } }, select: { id: true },
    })) fail(409, 'PHONE_TAKEN', 'This mobile number already belongs to another account.');
    const emailChanged = details.email !== undefined && details.email !== student.user.email;
    if (emailChanged && await tx.user.findUnique({ where: { email: details.email }, select: { id: true } })) {
      fail(409, 'EMAIL_TAKEN', 'This email already belongs to another account.');
    }
    if (details.name !== undefined || emailChanged) await tx.user.update({
      where: { id: student.userId },
      data: { name: details.name, ...(emailChanged ? {
        email: details.email, emailVerifiedAt: null, emailOtpHash: null,
        emailOtpExpiresAt: null, emailOtpAttempts: 0, emailOtpLastSentAt: null,
      } : {}) },
    });
    if (emailChanged || data.status === 'ARCHIVED') {
      await tx.accountToken.updateMany({ where: { userId: student.userId, usedAt: null }, data: { usedAt: new Date() } });
    }
    const record = await tx.studentAccount.update({
      where: { id: studentId }, data: {
        status: data.status, phone: details.phone === '' ? null : details.phone, phoneKey, gender: details.gender,
      },
    });
    if (emailChanged || data.status === 'DISABLED' || data.status === 'ARCHIVED') {
      await tx.session.deleteMany({ where: { userId: student.userId } });
    }
    await tx.auditLog.create({ data: {
      actorId, action: data.status === 'ARCHIVED' ? 'STUDENT_ARCHIVED' : data.status ? 'STUDENT_STATUS' : 'STUDENT_UPDATED',
      entityType: 'StudentAccount', entityId: studentId,
      metadata: { ...(data.status ? { status: data.status } : {}), emailChanged },
    } });
    return { id: record.id, status: record.status };
  }, { isolationLevel: 'Serializable' });
}

router.patch('/admin/students/:id', asyncRoute(async (req, res) => {
  const data = await updateStudent(id.parse(req.params.id), req.auth!.userId, studentUpdate.parse(req.body));
  res.json({ data });
}));
router.delete('/admin/students/:id', asyncRoute(async (req, res) => {
  const data = await updateStudent(id.parse(req.params.id), req.auth!.userId, { status: 'ARCHIVED' });
  res.json({ data });
}));
router.delete('/admin/students/:id/permanent', asyncRoute(async (req, res) => {
  const studentId = id.parse(req.params.id);
  try {
    await prisma.$transaction(async tx => {
      const student = await tx.studentAccount.findFirst({
        where: { id: studentId, user: { platformRole: 'USER' } },
        select: { userId: true },
      });
      if (!student) fail(404, 'STUDENT_NOT_FOUND', 'Student not found.');
      await tx.studentAccount.delete({ where: { id: studentId } });
      await tx.user.delete({ where: { id: student.userId } });
      await tx.auditLog.create({ data: {
        actorId: req.auth!.userId, action: 'STUDENT_DELETED', entityType: 'StudentAccount', entityId: studentId,
      } });
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      fail(409, 'STUDENT_HAS_RECORDS', 'This student has linked records. Archive the account to keep their history.');
    }
    throw error;
  }
  res.json({ data: { id: studentId } });
}));
router.get('/admin/courses', asyncRoute(async (req, res) => {
  const { page, pageSize, skip, q } = pageInput(req.query);
  const track = z.nativeEnum(CourseTrack).optional().parse(req.query.track);
  const where = { tenantId: null, ...(track ? { track } : {}), ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}) };
  const [total, courses] = await prisma.$transaction([prisma.course.count({ where }),
    prisma.course.findMany({ where, skip, take: pageSize, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { _count: { select: { directEnrollments: true, lessons: true } } } })]);
  sendList(res, courses, total, page, pageSize);
}));
router.get('/admin/courses/:id', asyncRoute(async (req, res) => {
  const course = await prisma.course.findFirst({ where: { id: id.parse(req.params.id), tenantId: null },
    include: { lessons: { orderBy: lessonOrder, omit: { legacyModuleId: true }, include: { resources: { orderBy: resourceOrder } } } } });
  if (!course) fail(404, 'COURSE_NOT_FOUND', 'Course not found.');
  res.json({ data: course });
}));
router.post('/admin/courses', asyncRoute(async (req, res) => {
  const data = courseInput.parse(req.body);
  const course = await prisma.course.create({ data: { ...data, tenantId: null } });
  await prisma.auditLog.create({ data: { actorId: req.auth!.userId, action: 'COURSE_CREATE', entityType: 'Course', entityId: course.id } });
  res.status(201).json({ data: course });
}));
router.delete('/admin/courses/:id', asyncRoute(async (req, res) => {
  const courseId = id.parse(req.params.id);
  const updated = await prisma.course.updateMany({ where: { id: courseId, tenantId: null }, data: { status: 'ARCHIVED' } });
  if (!updated.count) fail(404, 'COURSE_NOT_FOUND', 'Course not found.');
  await prisma.auditLog.create({ data: { actorId: req.auth!.userId, action: 'COURSE_ARCHIVE', entityType: 'Course', entityId: courseId } });
  res.json({ data: { id: courseId, status: 'ARCHIVED' } });
}));
router.patch('/admin/courses/:id', asyncRoute(async (req, res) => {
  const courseId = id.parse(req.params.id);
  const data = courseInput.partial().parse(req.body);
  const course = await prisma.course.updateMany({ where: { id: courseId, tenantId: null }, data });
  if (!course.count) fail(404, 'COURSE_NOT_FOUND', 'Course not found.');
  const result = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  await prisma.auditLog.create({ data: { actorId: req.auth!.userId, action: 'COURSE_UPDATE', entityType: 'Course', entityId: courseId } });
  res.json({ data: result });
}));
router.post('/admin/courses/:id/videos', asyncRoute(async (req, res) => {
  const courseId = id.parse(req.params.id);
  const data = lessonInput.omit({ kind: true }).extend({ contentUrl: resourceUrl }).parse(req.body);
  const record = await prisma.$transaction(async tx => {
    if (!await tx.course.findFirst({ where: { id: courseId, tenantId: null }, select: { id: true } })) fail(404, 'COURSE_NOT_FOUND', 'Course not found.');
    const last = await tx.lesson.aggregate({ where: { courseId }, _max: { position: true } });
    return tx.lesson.create({ data: { ...data, courseId, kind: 'VIDEO', position: (last._max.position ?? -1) + 1 } });
  }, { isolationLevel: 'Serializable' });
  res.status(201).json({ data: record });
}));
router.patch('/admin/courses/:id/lesson-order', asyncRoute(async (req, res) => {
  const courseId = id.parse(req.params.id);
  const ids = z.array(id).max(1000).parse(req.body.ids);
  await prisma.$transaction(async tx => {
    if (!await tx.course.findFirst({ where: { id: courseId, tenantId: null }, select: { id: true } })) fail(404, 'COURSE_NOT_FOUND', 'Course not found.');
    const lessons = await tx.lesson.findMany({ where: { courseId }, select: { id: true } });
    if (ids.length !== lessons.length || new Set(ids).size !== ids.length || lessons.some(lesson => !ids.includes(lesson.id))) {
      fail(422, 'INVALID_ORDER', 'Include every lesson exactly once.');
    }
    for (const [position, lessonId] of ids.entries()) await tx.lesson.update({ where: { id: lessonId }, data: { position } });
    await tx.auditLog.create({ data: { actorId: req.auth!.userId, action: 'LESSONS_REORDERED', entityType: 'Course', entityId: courseId } });
  }, { isolationLevel: 'Serializable' });
  res.json({ data: { success: true } });
}));
router.patch('/admin/lessons/:id/archive', asyncRoute(async (req, res) => {
  const lessonId = id.parse(req.params.id);
  const archived = z.boolean().parse(req.body.archived);
  await prisma.$transaction(async tx => {
    const updated = await tx.lesson.updateMany({ where: { id: lessonId, course: { tenantId: null } }, data: { archivedAt: archived ? new Date() : null } });
    if (!updated.count) fail(404, 'LESSON_NOT_FOUND', 'Lesson not found.');
    await tx.auditLog.create({ data: { actorId: req.auth!.userId, action: archived ? 'LESSON_ARCHIVED' : 'LESSON_RESTORED', entityType: 'Lesson', entityId: lessonId } });
  });
  res.json({ data: { success: true } });
}));
router.patch('/admin/lessons/:id', asyncRoute(async (req, res) => {
  const lessonId = id.parse(req.params.id);
  const result = await prisma.lesson.updateMany({
    where: { id: lessonId, course: { tenantId: null } }, data: lessonInput.omit({ kind: true }).partial().parse(req.body),
  });
  if (!result.count) fail(404, 'LESSON_NOT_FOUND', 'Lesson not found.');
  res.json({ data: await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } }) });
}));
const resourceInput = z.object({ title: z.string().trim().min(1).max(180), kind: z.nativeEnum(LessonResourceKind), url: resourceUrl }).strict();
router.post('/admin/lessons/:id/resources', asyncRoute(async (req, res) => {
  const lessonId = id.parse(req.params.id);
  const data = resourceInput.parse(req.body);
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, course: { tenantId: null } }, select: { id: true } });
  if (!lesson) fail(404, 'LESSON_NOT_FOUND', 'Lesson not found.');
  res.status(201).json({ data: await prisma.lessonResource.create({ data: { ...data, lessonId } }) });
}));
router.patch('/admin/lessons/:id/resources/:resourceId', asyncRoute(async (req, res) => {
  const resourceId = id.parse(req.params.resourceId);
  const result = await prisma.lessonResource.updateMany({
    where: { id: resourceId, lessonId: id.parse(req.params.id), lesson: { course: { tenantId: null } } },
    data: resourceInput.partial().parse(req.body),
  });
  if (!result.count) fail(404, 'RESOURCE_NOT_FOUND', 'Lesson resource not found.');
  res.json({ data: { id: resourceId } });
}));
router.delete('/admin/lessons/:id/resources/:resourceId', asyncRoute(async (req, res) => {
  const resourceId = id.parse(req.params.resourceId);
  const result = await prisma.lessonResource.deleteMany({
    where: { id: resourceId, lessonId: id.parse(req.params.id), lesson: { course: { tenantId: null } } },
  });
  if (!result.count) fail(404, 'RESOURCE_NOT_FOUND', 'Lesson resource not found.');
  res.json({ data: { id: resourceId } });
}));
router.get('/admin/orders', asyncRoute(async (req, res) => {
  const status = req.query.status ? z.enum(['PENDING', 'PAID', 'CANCELLED']).parse(req.query.status) : undefined;
  const orders = await prisma.courseOrder.findMany({ where: { course: { tenantId: null }, ...(status ? { status } : {}) },
    include: { course: { select: { title: true } }, user: { select: { name: true, email: true, directStudent: { select: { studentCode: true } } } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ data: orders });
}));
router.post('/admin/orders/:id/approve', asyncRoute(async (req, res) => {
  const orderId = id.parse(req.params.id);
  const note = z.object({ note: z.string().trim().max(1000).optional() }).parse(req.body);
  const adminId = req.auth!.userId;
  const order = await prisma.$transaction(async tx => {
    const order = await tx.courseOrder.findFirst({ where: { id: orderId, course: { tenantId: null } } });
    if (!order) fail(404, 'ORDER_NOT_FOUND', 'Order not found.');
    if (order.paymentMethod === 'RAZORPAY') fail(409, 'ONLINE_ORDER', 'Online orders are confirmed by Razorpay.');
    if (order.status !== 'PENDING') fail(409, 'ORDER_NOT_PENDING', 'Order was already processed.');
    const current = await tx.directEnrollment.findUnique({ where: { userId_courseId: { userId: order.userId, courseId: order.courseId } } });
    if (current && enrollmentActive(current)) fail(409, 'ALREADY_ENROLLED', 'Student already has course access. Resolve the payment request separately.');
    const claimed = await tx.courseOrder.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'PAID', verifiedAt: new Date(), verifiedById: adminId, note: note.note } });
    if (claimed.count !== 1) fail(409, 'ORDER_CHANGED', 'Order already processed.');
    await tx.directEnrollment.upsert({ where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
      create: { userId: order.userId, courseId: order.courseId, source: 'MANUAL_PAYMENT', status: 'ACTIVE', grantedById: adminId, note: `Verified offline order ${orderId}` },
      update: { expiresAt: null, status: 'ACTIVE', source: 'MANUAL_PAYMENT', grantedById: adminId, revokedAt: null, note: `Verified offline order ${orderId}` } });
    await tx.auditLog.create({ data: { actorId: adminId, action: 'ORDER_MANUAL_VERIFY', entityType: 'CourseOrder', entityId: orderId, metadata: { courseId: order.courseId, userId: order.userId } } });
    return { ...order, status: 'PAID' };
  });
  res.json({ data: order });
}));
router.post('/admin/orders/:id/reject', asyncRoute(async (req, res) => {
  const orderId = id.parse(req.params.id);
  const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
  const result = await prisma.$transaction(async tx => {
    const order = await tx.courseOrder.findFirst({ where: { id: orderId, course: { tenantId: null } } });
    if (!order) fail(404, 'ORDER_NOT_FOUND', 'Order not found.');
    if (order.paymentMethod === 'RAZORPAY') fail(409, 'ONLINE_ORDER', 'Online orders are managed by Razorpay.');
    const updated = await tx.courseOrder.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'CANCELLED', note: reason, verifiedById: req.auth!.userId, verifiedAt: new Date() } });
    if (!updated.count) fail(409, 'ORDER_ALREADY_PROCESSED', 'Order already processed.');
    await tx.auditLog.create({ data: { actorId: req.auth!.userId, action: 'OFFLINE_ORDER_REJECT', entityType: 'CourseOrder', entityId: orderId, metadata: { reason } } });
    return { id: orderId, status: 'CANCELLED' };
  });
  res.json({ data: result });
}));
router.post('/admin/enrollments', asyncRoute(async (req, res) => {
  const input = grantInput.parse(req.body);
  const adminId = req.auth!.userId;
  const student = await prisma.studentAccount.findFirst({ where: { OR: [{ studentCode: input.studentCode }, { user: { email: input.studentCode.toLowerCase() } }] } });
  if (!student || student.status !== 'ACTIVE') fail(404, 'STUDENT_NOT_FOUND', 'Active student not found.');
  const course = await prisma.course.findFirst({ where: { id: input.courseId, tenantId: null, status: { not: 'ARCHIVED' } } });
  if (!course) fail(404, 'COURSE_NOT_FOUND', 'Course not found.');
  const enrollment = await prisma.$transaction(async tx => {
    const current = await tx.directEnrollment.findUnique({ where: { userId_courseId: { userId: student.userId, courseId: course.id } } });
    if (current && enrollmentActive(current)) fail(409, 'ALREADY_ENROLLED', 'This student already has course access.');
    const record = await tx.directEnrollment.upsert({ where: { userId_courseId: { userId: student.userId, courseId: course.id } },
      create: { userId: student.userId, courseId: course.id, source: input.source, status: 'ACTIVE', grantedById: adminId, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, note: input.note },
      update: { status: 'ACTIVE', source: input.source, revokedAt: null, grantedById: adminId, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, note: input.note } });
    if (input.source === 'MANUAL_PAYMENT') {
      await tx.courseOrder.create({ data: { userId: student.userId, courseId: course.id, amountPaise: input.amountPaise!,
        paymentMethod: input.paymentMethod!, paymentReference: input.paymentReference, note: input.note,
        status: 'PAID', verifiedAt: new Date(), verifiedById: adminId } });
    }
    await tx.auditLog.create({ data: { actorId: adminId, action: 'COURSE_ACCESS_GRANT', entityType: 'DirectEnrollment', entityId: record.id,
      metadata: { studentCode: input.studentCode, courseId: course.id, source: input.source, expiresAt: input.expiresAt || null, note: input.note } } });
    return record;
  }, { isolationLevel: 'Serializable' });
  res.status(201).json({ data: enrollment });
}));
router.get('/admin/enrollments/:id/history', asyncRoute(async (req, res) => {
  const enrollmentId = id.parse(req.params.id);
  const enrollment = await prisma.directEnrollment.findFirst({ where: { id: enrollmentId, course: { tenantId: null } } });
  if (!enrollment) fail(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found.');
  const history = await prisma.auditLog.findMany({ where: { entityType: 'DirectEnrollment', entityId: enrollmentId }, orderBy: { createdAt: 'desc' }, take: 100 });
  const actors = await prisma.user.findMany({ where: { id: { in: history.map(h => h.actorId) } }, select: { id: true, name: true } });
  res.json({ data: history.map(h => ({ id: h.id, action: h.action, createdAt: h.createdAt, metadata: h.metadata, actor: actors.find(a => a.id === h.actorId)?.name || 'Former administrator' })) });
}));
router.post('/admin/enrollments/:id/restore', asyncRoute(async (req, res) => {
  const enrollmentId = id.parse(req.params.id);
  const input = z.object({ reason: z.string().trim().min(3).max(500), expiresAt: z.string().datetime().refine(v => new Date(v) > new Date()).nullable().optional() }).parse(req.body);
  await prisma.$transaction(async tx => {
    const current = await tx.directEnrollment.findFirst({ where: { id: enrollmentId, course: { tenantId: null } } });
    if (!current) fail(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found.');
    if (current && enrollmentActive(current)) fail(409, 'ALREADY_ACTIVE', 'Course access is already active.');
    const student = await tx.studentAccount.findUnique({ where: { userId: current.userId } });
    if (student?.status !== 'ACTIVE') fail(409, 'STUDENT_DISABLED', 'Enable the student account before restoring access.');
    await tx.directEnrollment.update({ where: { id: enrollmentId }, data: { status: 'ACTIVE', revokedAt: null, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, note: input.reason, grantedById: req.auth!.userId } });
    await tx.auditLog.create({ data: { actorId: req.auth!.userId, action: 'COURSE_ACCESS_RESTORE', entityType: 'DirectEnrollment', entityId: enrollmentId, metadata: { reason: input.reason, expiresAt: input.expiresAt || null } } });
  }, { isolationLevel: 'Serializable' });
  res.json({ data: { success: true } });
}));
router.post('/admin/enrollments/:id/revoke', asyncRoute(async (req, res) => {
  const enrollmentId = id.parse(req.params.id);
  const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
  const record = await prisma.$transaction(async tx => {
    const current = await tx.directEnrollment.findFirst({ where: { id: enrollmentId, course: { tenantId: null } } });
    if (!current) fail(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found.');
    if (current.status !== 'ACTIVE') fail(409, 'ALREADY_REVOKED', 'Course access has already been revoked.');
    const result = await tx.directEnrollment.updateMany({ where: { id: enrollmentId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date(), note: reason } });
    if (!result.count) fail(409, 'ENROLLMENT_CHANGED', 'Enrollment changed during request.');
    await tx.auditLog.create({ data: { actorId: req.auth!.userId, action: 'COURSE_ACCESS_REVOKE', entityType: 'DirectEnrollment', entityId: enrollmentId, metadata: { reason } } });
    return { id: enrollmentId, status: 'REVOKED' };
  });
  res.json({ data: record });
}));

export default router;
