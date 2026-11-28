export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
let csrfToken = '';
export function setCsrf(value: string) { csrfToken = value; }
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(!['GET', 'HEAD'].includes(options.method || 'GET') && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...options.headers },
  });
  return readResponse<T>(response.status, await response.text());
}
function readResponse<T>(status: number, body: string): T {
  let payload: { error?: { code?: string; message?: string } } | null;
  try { payload = JSON.parse(body); }
  catch { throw new ApiError(status, 'INVALID_RESPONSE', 'Could not read server response.'); }
  if (status < 200 || status >= 300) {
    throw new ApiError(status, payload?.error?.code || 'API_ERROR', payload?.error?.message || 'Request failed.');
  }
  return payload as T;
}
export function upload<T>(path: string, file: File, mime: string, onProgress: (percent: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.floor(event.loaded / event.total * 100));
    };
    request.open('POST', API_URL + path);
    request.withCredentials = true;
    request.setRequestHeader('Content-Type', mime);
    if (csrfToken) request.setRequestHeader('X-CSRF-Token', csrfToken);
    request.onload = () => {
      try { resolve(readResponse<T>(request.status, request.responseText)); }
      catch (error) { reject(error); }
    };
    request.onerror = () => reject(new Error('The upload connection failed. Please try again.'));
    request.onabort = () => reject(new Error('The upload was interrupted.'));
    request.send(file);
  });
}
export type ApiOne<T> = { data: T };
export type ApiList<T> = { data: T[]; meta: { total: number; page: number; pageSize: number; pages: number } };
export const messageFromError = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
