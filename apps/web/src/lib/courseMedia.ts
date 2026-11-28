import { API_URL, upload, type ApiOne } from './api';

const mimeByExtension: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
};

export async function uploadCourseMedia(courseId: string, file: File, onProgress: (percent: number) => void) {
  const mime = mimeByExtension[file.name.split('.').at(-1)?.toLowerCase() ?? ''] ?? file.type;
  const maxMb = mime === 'video/mp4' || mime === 'video/webm' ? 500 : 50;
  if (file.size > maxMb * 1024 * 1024) throw new Error(`Choose a file up to ${maxMb} MB.`);
  return (await upload<ApiOne<{ url: string; mime: string }>>('/media/courses/' + courseId, file, mime, onProgress)).data;
}

export function courseMediaCredentials(url: string): 'use-credentials' | undefined {
  const route = new URL(API_URL.replace(/\/$/, '') + '/media/', window.location.href);
  let asset: URL;
  try { asset = new URL(url, window.location.href); } catch { return; }
  if (asset.origin === route.origin && asset.pathname.startsWith(route.pathname)) return 'use-credentials';
}
