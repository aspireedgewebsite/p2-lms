import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, PageTitle, Skeleton } from '../components/UI';
import { api, messageFromError, type ApiOne } from '../lib/api';
import { uploadCourseMedia } from '../lib/courseMedia';
import type { LessonResource } from '../lib/lessonResources';

type Lesson = {
  id: string; title: string; kind: 'TEXT' | 'VIDEO' | 'PDF' | 'LINK';
  content: string | null; contentUrl: string | null; isPreview: boolean; published: boolean;
  archivedAt: string | null; resources: LessonResource[];
};
type FullCourse = {
  title: string; track: string; instructor: string | null; lessons: Lesson[];
};
type Draft = Pick<Lesson, 'kind' | 'isPreview' | 'published'> & {
  id?: string; title: string; content: string; contentUrl: string;
};
type ResourceDraft = { lessonId: string; id?: string; title: string; kind: LessonResource['kind']; url: string };

export function AdminCourseBuilder() {
  const { id } = useParams();
  const [course, setCourse] = useState<FullCourse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [resource, setResource] = useState<ResourceDraft | null>(null);
  const lessonDialog = useRef<HTMLDialogElement>(null);
  const editingLesson = draft !== null;
  useEffect(() => {
    if (!editingLesson) return;
    const dialog = lessonDialog.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [editingLesson]);
  const load = useCallback(async () => {
    const result = await api<ApiOne<FullCourse>>(`/academy/admin/courses/${id}`);
    setCourse(result.data);
  }, [id]);
  useEffect(() => { void load().catch(error => setError(messageFromError(error))); }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try { await action(); await load(); } catch (error) { setError(messageFromError(error)); } finally { setBusy(false); }
  }
  async function mutate(path: string, method: string, body?: object) {
    await api(`/academy/admin${path}`, { method, body: body && JSON.stringify(body) });
  }
  function editLesson(lesson?: Lesson) {
    setError('');
    setResource(null);
    setDraft(lesson ? {
      id: lesson.id, kind: lesson.kind, title: lesson.title, content: lesson.content ?? '',
      contentUrl: lesson.contentUrl ?? '', isPreview: lesson.isPreview, published: lesson.published,
    } : { kind: 'VIDEO', title: '', content: '', contentUrl: '', isPreview: false, published: false });
  }
  function saveLesson(event: FormEvent) {
    event.preventDefault();
    if (!draft || !id) return;
    const body = { title: draft.title, content: draft.content || null, contentUrl: draft.contentUrl || null,
      isPreview: draft.isPreview, published: draft.published };
    void run(async () => {
      await mutate(draft.id ? `/lessons/${draft.id}` : `/courses/${id}/videos`, draft.id ? 'PATCH' : 'POST', body);
      setDraft(null);
    });
  }
  function uploadVideo(file?: File) {
    if (!file || !id) return;
    void run(async () => {
      const asset = await uploadCourseMedia(id, file);
      setDraft(current => current && { ...current, contentUrl: asset.url });
    });
  }
  function move(index: number, direction: number) {
    if (!course) return;
    const ids = course.lessons.map(lesson => lesson.id);
    const destination = index + direction;
    if (destination < 0 || destination >= ids.length) return;
    [ids[index], ids[destination]] = [ids[destination]!, ids[index]!];
    void run(() => mutate(`/courses/${id}/lesson-order`, 'PATCH', { ids }));
  }
  function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resource || !id) return;
    const form = event.currentTarget;
    const file = new FormData(form).get('file');
    void run(async () => {
      const { id: resourceId, lessonId, title, kind } = resource;
      let url = resource.url;
      if (file instanceof File && file.size) {
        url = (await uploadCourseMedia(id, file)).url;
        const uploadedUrl = url;
        setResource(current => current && { ...current, url: uploadedUrl });
        const input = form.elements.namedItem('file');
        if (input instanceof HTMLInputElement) input.value = '';
      }
      await mutate(`/lessons/${lessonId}/resources${resourceId ? '/' + resourceId : ''}`, resourceId ? 'PATCH' : 'POST', { title, kind, url });
      setResource(null);
    });
  }
  const videoIds = course?.lessons.filter(lesson => lesson.kind === 'VIDEO' && !lesson.archivedAt).map(lesson => lesson.id) ?? [];
  const nextVideo = videoIds.length + 1;

  return <div className="course-content-builder">
    <PageTitle kicker="COURSE CONTENT" title={course?.title ?? 'Course content'}
      description="Add videos in order and manage the files attached to each lesson."
      action={<Link to={course ? `/admin/courses?track=${course.track}` : '/admin/courses'} className="academy-small-button">Back to courses</Link>}/>
    {!draft && error && <Alert message={error}/>}
    {!course ? !error && <Skeleton/> : <>
      <section className="academy-panel course-content-panel">
        <h2>Course instructor</h2>
        <form key={`${id}:${course.instructor ?? ''}`} className="course-instructor-form" onSubmit={event => {
          event.preventDefault();
          const instructor = String(new FormData(event.currentTarget).get('instructor') ?? '').trim();
          void run(() => mutate(`/courses/${id}`, 'PATCH', { instructor: instructor || null }));
        }}>
          <label>Instructor name<input name="instructor" maxLength={120} defaultValue={course.instructor ?? ''}/></label>
          <button className="primary-button" disabled={busy}>Save instructor</button>
        </form>
      </section>
      <section className="academy-panel course-content-panel">
        <div className="academy-actions course-content-toolbar"><button className="primary-button" disabled={busy} onClick={() => editLesson()}>Add Video {nextVideo}</button></div>
        {!course.lessons.length && <p>No lessons yet. Add the first video to get started.</p>}
        {course.lessons.map((lesson, index) => {
          const videoIndex = videoIds.indexOf(lesson.id);
          return <article className="academy-module course-content-lesson" key={lesson.id}>
            <div className="course-content-video">
            <h2>{videoIndex >= 0 && `Video ${videoIndex + 1} · `}{lesson.title}</h2>
            <p>{lesson.archivedAt ? 'Archived' : lesson.published ? 'Published' : 'Draft'}{lesson.isPreview ? ' · Free preview' : ' · After enrollment'}</p>
            <div className="academy-actions">
              <button className="academy-small-button" disabled={busy} onClick={() => editLesson(lesson)}>Edit {lesson.kind === 'VIDEO' ? 'video' : 'lesson'}</button>
              <button className="academy-small-button" disabled={busy || !!lesson.archivedAt} onClick={() => void run(() => mutate(`/lessons/${lesson.id}`, 'PATCH', { published: !lesson.published }))}>{lesson.published ? 'Unpublish' : 'Publish'}</button>
              <button className="academy-small-button" disabled={busy || index === 0} onClick={() => move(index, -1)}>Move up</button>
              <button className="academy-small-button" disabled={busy || index === course.lessons.length - 1} onClick={() => move(index, 1)}>Move down</button>
              <button className="academy-small-button" disabled={busy} onClick={() => void run(() => mutate(`/lessons/${lesson.id}/archive`, 'PATCH', { archived: !lesson.archivedAt }))}>{lesson.archivedAt ? 'Restore' : 'Archive'}</button>
            </div>
            {lesson.contentUrl && <details>
              <summary>{lesson.kind === 'VIDEO' ? 'View video' : 'View lesson file'}</summary>
              {lesson.kind === 'VIDEO' && <video controls preload="none" src={lesson.contentUrl} style={{ width: '100%', maxWidth: 680 }}/>}
              <p><a href={lesson.contentUrl} target="_blank" rel="noreferrer">Open file</a></p>
            </details>}
            </div>
            <section className="course-content-resources" aria-label={`Resources for ${lesson.title}`}>
            <h3>Lesson resources</h3>
            {!lesson.resources.length && <p>No resources attached.</p>}
            {lesson.resources.map(item => <div className="academy-lesson-row course-content-resource" key={item.id}>
              <a href={item.url} target="_blank" rel="noreferrer">{item.title} ({item.kind})</a>
              <button className="academy-small-button" disabled={busy} onClick={() => { setError(''); setResource({ ...item, lessonId: lesson.id }); }}>Edit or replace</button>
              <button className="academy-small-button academy-danger" disabled={busy} onClick={() => {
                if (window.confirm(`Remove ${item.title} from this lesson?`)) void run(async () => {
                  await mutate(`/lessons/${lesson.id}/resources/${item.id}`, 'DELETE');
                  if (resource?.id === item.id) setResource(null);
                });
              }}>Delete resource</button>
            </div>)}
            <div className="academy-actions">
              {(['PDF', 'PPT'] as const).map(kind => <button className="academy-small-button" key={kind} disabled={busy}
                onClick={() => { setError(''); setResource({ lessonId: lesson.id, kind, title: '', url: '' }); }}>Add {kind === 'PPT' ? 'PowerPoint' : 'PDF'}</button>)}
            </div>
            {resource?.lessonId === lesson.id && <form className="auth-form" key={resource.id ?? resource.kind} onSubmit={saveResource}>
              <h4>{resource.id ? 'Edit resource' : `Add ${resource.kind === 'PPT' ? 'PowerPoint' : 'PDF'}`}</h4>
              {error && <Alert message={error}/>}
              <label>Resource title<input required maxLength={180} value={resource.title} onChange={event => setResource({ ...resource, title: event.target.value })}/></label>
              <label>{resource.url ? 'Replace file (optional)' : 'Upload file (up to 50 MB)'}<input name="file" type="file"
                accept={resource.kind === 'PDF' ? '.pdf' : '.ppt,.pptx'} required={!resource.url} disabled={busy}/></label>
              <div className="academy-actions">
                <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save resource'}</button>
                <button className="academy-small-button" type="button" disabled={busy} onClick={() => setResource(null)}>Cancel</button>
              </div>
            </form>}
            </section>
          </article>;
        })}
      </section>
    </>}
    {draft && <dialog ref={lessonDialog} className="course-editor-dialog" aria-labelledby="lesson-editor-title"
      onCancel={event => { event.preventDefault(); if (!busy) setDraft(null); }}>
      <form className="course-editor-layout" onSubmit={saveLesson}>
        <header className="course-editor-heading">
          <h2 id="lesson-editor-title">{draft.id ? 'Edit lesson' : `Add Video ${nextVideo}`}</h2>
        </header>
        <div className="course-editor-fields academy-form-grid lesson-editor-fields">
          {error && <Alert message={error}/>}
          <label>{draft.kind === 'VIDEO' ? 'Video topic' : 'Lesson title'}<input required minLength={2} maxLength={180} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })}/></label>
          {draft.kind === 'VIDEO' && <label>Upload video (MP4 or WebM, up to 500 MB)<input type="file" accept=".mp4,.webm" disabled={busy} onChange={event => uploadVideo(event.target.files?.[0])}/></label>}
          <label>{draft.kind === 'VIDEO' ? 'Video URL' : 'Resource URL'}<input type="url" required={draft.kind === 'VIDEO'} value={draft.contentUrl} onChange={event => setDraft({ ...draft, contentUrl: event.target.value })}/></label>
          <label>Who can watch?<select value={draft.isPreview ? 'free' : 'enrolled'} onChange={event => setDraft({ ...draft, isPreview: event.target.value === 'free' })}>
            <option value="enrolled">After enrollment</option>
            <option value="free">Free preview</option>
          </select></label>
          <p className="academy-small">{draft.isPreview ? 'Anyone can watch this preview and open its resources once the lesson and course are published.' : 'Only students with active course enrollment can watch this lesson and open its resources once the lesson is published.'}</p>
          <label>Lesson notes<textarea rows={3} maxLength={25000} value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })}/></label>
          <label className="lesson-checkbox"><input type="checkbox" checked={draft.published} onChange={event => setDraft({ ...draft, published: event.target.checked })}/> Publish lesson</label>
        </div>
        <footer className="course-editor-actions">
          <button className="academy-small-button" type="button" disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
          <button className="primary-button" disabled={busy}>{busy ? 'Please wait...' : draft.id ? 'Save lesson' : `Save Video ${nextVideo}`}</button>
        </footer>
      </form>
    </dialog>}
  </div>;
}
