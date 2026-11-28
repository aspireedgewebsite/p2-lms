import { uploadCourseMedia } from '../lib/courseMedia';
import { courseTrackInfo, courseTracks, type CourseTrack } from '../lib/courseTracks';
import { StudentGenderField, type StudentGender } from '../components/StudentGenderField';
import { FormEvent, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, GraduationCap, IndianRupee, Plus, ShoppingBag, X, UserRoundCheck, ArrowRight, LockKeyhole } from 'lucide-react';
import { Alert, Badge, EmptyState, PageTitle, Skeleton, StatCard } from '../components/UI';
import { api, messageFromError, type ApiList, type ApiOne } from '../lib/api';
import { inr, type Course } from './Public';

type TrackStats = { track: CourseTrack; courses: number; published: number; draft: number; archived: number };
type Dashboard = {tracks: TrackStats[];students:number;courses:number;publishedCourses:number;activeEnrollments:number;manualEnrollments:number;pendingOrders:number;recordedRevenuePaise:number;recordedPayments:number};
type Student = {id:string;userId:string;studentCode:string;name:string;email:string;phone:string|null;gender:StudentGender|null;emailVerified:boolean;status:'ACTIVE'|'DISABLED'|'ARCHIVED';enrolledCourses:{id:string;title:string;status:string;expiresAt:string|null;source:string;completed:number;total:number;progressPercent:number}[]};
type AdminCourse = Course & {_count?:{lessons:number;directEnrollments:number}};
type Order = {id:string;amountPaise:number;status:'PENDING'|'PAID'|'CANCELLED';paymentMethod:string|null;paymentReference:string|null;createdAt:string;course:{title:string};user:{name:string;email:string;directStudent:{studentCode:string}|null}};
export function AdminDashboard(){const [data,setData]=useState<Dashboard|null>(null);const [error,setError]=useState('');useEffect(()=>{api<ApiOne<Dashboard>>('/academy/admin/dashboard').then(r=>setData(r.data)).catch(e=>setError(messageFromError(e)));},[]);return <><PageTitle kicker="ACADEMY OVERVIEW" title="Your academy, at a glance" description="Monitor students, access, payments and learning content."/>{error&&<Alert message={error}/>} {!data?<Skeleton/>:<><div className="stat-grid"><StatCard title="Registered students" value={data.students} icon={<GraduationCap size={22}/>}/><StatCard title="Published courses" value={data.publishedCourses} icon={<BookOpen size={22}/>} tone="aqua"/><StatCard title="Active enrollments" value={data.activeEnrollments} icon={<UserRoundCheck size={22}/>} tone="violet"/><StatCard title="Pending payment requests" value={data.pendingOrders} icon={<ShoppingBag size={22}/>} tone="amber"/><StatCard title="Manually paid enrollments" value={data.manualEnrollments} icon={<LockKeyhole size={22}/>} tone="indigo"/><StatCard title="Recorded payments" value={inr(data.recordedRevenuePaise)} icon={<IndianRupee size={22}/>} tone="aqua"/></div><section className="academy-panel"><h2>Courses by track</h2><TrackCards stats={data.tracks}/></section><div className="academy-quick-links"><Link className="academy-panel" to="/admin/courses"><BookOpen/><strong>Manage courses</strong><p>Create and publish learning content.</p><ArrowRight size={17}/></Link><Link className="academy-panel" to="/admin/access"><UserRoundCheck/><strong>Grant course access</strong><p>Find a student by ID and unlock any course.</p><ArrowRight size={17}/></Link><Link className="academy-panel" to="/admin/students"><GraduationCap/><strong>Manage students</strong><p>Add students, update accounts, and review progress.</p><ArrowRight size={17}/></Link></div></>}</>}
function CourseDialog({ title, busy, close, save, children }: {
  title: string;
  busy: boolean;
  close: () => void;
  save: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);

  return <dialog ref={dialog} className="course-editor-dialog" aria-labelledby="course-editor-title"
    onCancel={event => { event.preventDefault(); if (!busy) close(); }}
    onClick={event => { if (!busy && event.target === event.currentTarget) close(); }}>
    <form className="course-editor-layout" onSubmit={save}>
      <header className="course-editor-heading">
        <h2 id="course-editor-title">{title}</h2>
        <button className="icon-button" type="button" aria-label="Close course editor" disabled={busy} onClick={close}><X size={21}/></button>
      </header>
      <div className="course-editor-fields academy-form-grid">{children}</div>
      <footer className="course-editor-actions">
        <button type="button" className="academy-small-button" disabled={busy} onClick={close}>Cancel</button>
        <button disabled={busy} className="primary-button">{busy ? 'Saving…' : 'Save course'}</button>
      </footer>
    </form>
  </dialog>;
}

function TrackCards({ stats }: { stats: TrackStats[] }) {
 return <div className="course-track-grid">{courseTracks.map(item => {
  const count = stats.find(row => row.track === item.id);
  return <Link key={item.id} className="academy-panel course-track-link" to={`/admin/courses?track=${item.id}`}>
   <strong>{item.title}</strong>
   {count && <span>{count.courses} courses · {count.published} published · {count.draft} draft · {count.archived} archived</span>}
  </Link>;
 })}</div>;
}

const emptyForm = {title:'',description:'',previewText:'',category:'',track:'SKILL_BOOST' as CourseTrack,level:'BEGINNER',priceRupees:'',durationHours:'',thumbnailUrl:'',status:'DRAFT'};
export function AdminCourses(){
 const [params] = useSearchParams();
 const track = courseTrackInfo(params.get('track') ?? '')?.id ?? '';
 const [stats, setStats] = useState<TrackStats[]>([]);
 const [page, setPage] = useState(1);
 const [pages, setPages] = useState(1);
const [courses,setCourses]=useState<AdminCourse[]>([]);const [q,setQ]=useState('');const [search,setSearch]=useState('');const [error,setError]=useState('');const [notice,setNotice]=useState('');const [form,setForm]=useState(emptyForm);const [editing,setEditing]=useState<string|null>(null);const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);
const navigate = useNavigate();
const createdCourse = useRef<string | null>(null);
const [thumbnail, setThumbnail] = useState<File>();
const load = useCallback(async () => {
 try {
  if (!track) {
   const result = await api<ApiOne<Dashboard>>('/academy/admin/dashboard');
   setStats(result.data.tracks);
   return;
  }
  const result = await api<ApiList<AdminCourse>>(`/academy/admin/courses?pageSize=20&page=${page}&q=${encodeURIComponent(search)}&track=${track}`);
  setCourses(result.data);
  setPages(result.meta.pages);
 } catch (error) { setError(messageFromError(error)); }
}, [search, track, page]);
useEffect(() => { setPage(1); setQ(''); setSearch(''); setCourses([]); }, [track]);
useEffect(() => { void load(); }, [load]);
function edit(c:AdminCourse){createdCourse.current=null;setThumbnail(undefined);setError('');setEditing(c.id);setForm({title:c.title,description:c.description||'',previewText:c.previewText||'',category:c.category||'',track:c.track,level:c.level,priceRupees:(c.pricePaise/100).toString(),durationHours:c.durationHours?.toString()||'',thumbnailUrl:c.thumbnailUrl||'',status:c.status});setOpen(true)}
async function save(event: FormEvent) {
 event.preventDefault();
 if (busy) return;
 setBusy(true);
 setError('');
 try {
  const courseId = editing ?? createdCourse.current;
  const body = { title: form.title, description: form.description, previewText: form.previewText,
   category: form.category, track: form.track, level: form.level, pricePaise: Math.round(Number(form.priceRupees || 0) * 100),
   durationHours: form.durationHours ? Number(form.durationHours) : null, thumbnailUrl: form.thumbnailUrl || null, status: form.status };
  const result = await api<ApiOne<AdminCourse>>(courseId ? `/academy/admin/courses/${courseId}` : '/academy/admin/courses', {
   method: courseId ? 'PATCH' : 'POST', body: JSON.stringify(body),
  });
  const savedId = result.data.id;
  if (!editing) createdCourse.current = savedId;
  if (thumbnail) {
   const asset = await uploadCourseMedia(savedId, thumbnail);
   setForm(current => ({ ...current, thumbnailUrl: asset.url }));
   setThumbnail(undefined);
   await api(`/academy/admin/courses/${savedId}`, { method: 'PATCH', body: JSON.stringify({ thumbnailUrl: asset.url }) });
  }
  setOpen(false);
  if (!editing) navigate(`/admin/courses/${savedId}`);
  else { setNotice('Course updated.'); void load(); }
 } catch (error) {
  setError(messageFromError(error));
  if (createdCourse.current) load();
 } finally { setBusy(false); }
}
async function archive(c:AdminCourse){if(!window.confirm(`Archive ${c.title}? Existing enrollments remain recorded.`))return;try{await api(`/academy/admin/courses/${c.id}`,{method:'DELETE'});load();}catch(e){setError(messageFromError(e))}}
async function setCourseStatus(course: AdminCourse, status: 'PUBLISHED' | 'DRAFT') {
 try {
  await api(`/academy/admin/courses/${course.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  void load();
 } catch (error) { setError(messageFromError(error)); }
}
return <><PageTitle kicker="COURSE MANAGEMENT" title={courseTrackInfo(track)?.title ?? 'Course tracks'}
 description={track ? 'Manage courses in this track.' : 'Select a track to manage its courses.'}
 action={track && <button className="primary-button inline-button" onClick={() => {
  setError(''); createdCourse.current = null; setThumbnail(undefined); setEditing(null); setForm({ ...emptyForm, track }); setOpen(true);
 }}><Plus size={17}/> Add course</button>}/>
 {!open && error && <Alert message={error} onClose={() => setError('')}/>}
 {notice && <Alert success message={notice} onClose={() => setNotice('')}/>}
 {!track ? <TrackCards stats={stats}/> : <section className="academy-panel">
  <Link className="academy-small-button" to="/admin/courses">All tracks</Link>
  <form className="academy-search" onSubmit={event => { event.preventDefault(); setPage(1); setSearch(q); }}>
   <input value={q} onChange={event => setQ(event.target.value)} placeholder="Search courses" aria-label="Search courses"/>
   <button className="primary-button">Search</button>
  </form>
  <div className="academy-table-scroll"><table className="academy-table">
   <thead><tr><th>Course</th><th>Price</th><th>Status</th><th>Students</th><th>Actions</th></tr></thead>
   <tbody>{courses.map(course => <tr key={course.id}>
    <td><strong>{course.title}</strong>{course.category && <div className="academy-small">{course.category}</div>}</td>
    <td>{inr(course.pricePaise)}</td>
    <td><Badge variant={course.status === 'PUBLISHED' ? 'green' : course.status === 'DRAFT' ? 'amber' : 'red'}>{course.status}</Badge></td>
    <td>{course._count?.directEnrollments ?? 0}</td>
    <td><div className="academy-actions">
     <Link className="academy-small-button" to={`/admin/courses/${course.id}`}>Content</Link>
     <button className="academy-small-button" onClick={() => edit(course)}>Edit</button>
     <button className="academy-small-button" onClick={() => void setCourseStatus(course, course.status === 'DRAFT' ? 'PUBLISHED' : 'DRAFT')}>
      {course.status === 'DRAFT' ? 'Publish' : course.status === 'ARCHIVED' ? 'Restore as draft' : 'Unpublish'}
     </button>
     {course.status !== 'ARCHIVED' && <button className="academy-small-button academy-danger" onClick={() => void archive(course)}>Archive</button>}
    </div></td>
   </tr>)}</tbody>
  </table></div>
  {!courses.length && <EmptyState title="No courses found" subtitle="Add a course or search for another title."/>}
  {pages > 1 && <div className="academy-actions">
   <button className="academy-small-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
   <span>Page {page} of {pages}</span>
   <button className="academy-small-button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
  </div>}
 </section>}
{open && <CourseDialog title={editing ? 'Edit course' : 'Create a course'} busy={busy} close={() => { setOpen(false); setError(''); }} save={save}>
{error && <div className="academy-wide"><Alert message={error}/></div>}
<label>Course title<input required minLength={3} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Course type<select value={form.track} onChange={event=>setForm({...form,track:event.target.value as CourseTrack})}>{courseTracks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Price (₹)<input type="number" min="0" step="0.01" value={form.priceRupees} onChange={e=>setForm({...form,priceRupees:e.target.value})}/></label><label>Duration (hours)<input type="number" min="1" value={form.durationHours} onChange={e=>setForm({...form,durationHours:e.target.value})}/></label><label>Level<select value={form.level} onChange={e=>setForm({...form,level:e.target.value})}><option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label><label className="academy-wide">Short summary<textarea value={form.previewText} onChange={e=>setForm({...form,previewText:e.target.value})} rows={2}/></label><label className="academy-wide">Course description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={4}/></label><label className="academy-wide">Thumbnail image (PNG or JPEG)<input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={event => setThumbnail(event.target.files?.[0])}/></label><label className="academy-wide">Thumbnail URL (optional)<input type="url" value={form.thumbnailUrl} onChange={e=>setForm({...form,thumbnailUrl:e.target.value})}/></label><label>Topic<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label></CourseDialog>}</>}

export function AdminStudents() {
 const [history,setHistory]=useState<{id:string;action:string;actor:string;createdAt:string;metadata:{reason?:string;note?:string}|null}[]>([]);
 const [data, setData] = useState<Student[]>([]);
 const [q, setQ] = useState('');
 const [search, setSearch] = useState('');
 const [error, setError] = useState('');
 const [notice, setNotice] = useState('');
 const [selected, setSelected] = useState<string | null>(null);
 const [editor, setEditor] = useState<Student | 'new' | null>(null);
 const [busy, setBusy] = useState(false);
 const [formError, setFormError] = useState('');
 const [archived, setArchived] = useState(false);
 const [page, setPage] = useState(1);
 const [pages, setPages] = useState(0);
 const [revision, setRevision] = useState(0);
 const load = () => setRevision(value => value + 1);
 useEffect(() => {
  let current = true;
  api<ApiList<Student>>(`/academy/admin/students?pageSize=20&page=${page}&archived=${archived}&q=${encodeURIComponent(search)}`)
   .then(result => {
     if (!current) return;
     if (page > Math.max(1, result.meta.pages)) setPage(Math.max(1, result.meta.pages));
     setData(result.data);
     setPages(result.meta.pages);
   })
   .catch(err => { if (current) setError(messageFromError(err)); });
  return () => { current = false; };
 }, [search, page, archived, revision]);

 function openEditor(student: Student | 'new') {
  setFormError('');
  setNotice('');
  setEditor(student);
 }

 async function saveStudent(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!editor || busy) return;
  const fields = Object.fromEntries(new FormData(event.currentTarget));
  if (!fields.gender) delete fields.gender;
  setBusy(true);
  setFormError('');
  try {
   if (editor === 'new') {
    if (fields.password !== fields.confirmPassword) throw new Error('Passwords must match.');
    const { data: created } = await api<ApiOne<{ delivered: boolean }>>('/academy/admin/students', {
     method: 'POST', body: JSON.stringify(fields),
    });
    setNotice(created.delivered ? 'Student created. Verification email sent.' : 'Student created. Email delivery failed. The student can request a new code when signing in.');
    setArchived(false); setPage(1); setSearch(''); setQ('');
   } else {
    await api(`/academy/admin/students/${editor.id}`, { method: 'PATCH', body: JSON.stringify(fields) });
    setNotice(fields.email === editor.email ? 'Student updated.' : 'Student updated. They must verify the new email before signing in.');
   }
   setEditor(null);
   load();
  } catch (err) { setFormError(messageFromError(err)); }
  finally { setBusy(false); }
 }

 async function archiveStudent(student: Student) {
  if (!window.confirm(`Archive ${student.name}? This blocks sign-in and keeps their learning records.`)) return;
  try {
   await api(`/academy/admin/students/${student.id}`, { method: 'DELETE' });
   setSelected(null);
   setNotice('Student archived.');
   load();
  } catch (err) { setError(messageFromError(err)); }
 }
 async function deleteStudent(student: Student) {
  if (!window.confirm(`Permanently delete ${student.name}'s account? This cannot be undone.`)) return;
  setBusy(true);
  setError('');
  setNotice('');
  try {
   await api(`/academy/admin/students/${student.id}/permanent`, { method: 'DELETE' });
   setSelected(null);
   setEditor(null);
   setNotice('Student deleted.');
   if (data.length === 1 && page > 1) setPage(page - 1);
   else load();
  } catch (err) { setError(messageFromError(err)); }
  finally { setBusy(false); }
 }
 async function restore(enrollmentId:string){const reason=window.prompt('Reason for restoring course access:');if(!reason||reason.trim().length<3)return;try{await api(`/academy/admin/enrollments/${enrollmentId}/restore`,{method:'POST',body:JSON.stringify({reason})});load()}catch(e){setError(messageFromError(e))}}
 async function showHistory(enrollmentId:string){try{const r=await api<ApiOne<typeof history>>(`/academy/admin/enrollments/${enrollmentId}/history`);setHistory(r.data)}catch(e){setError(messageFromError(e))}}
 async function toggle(s:Student) {
  const action = s.status === 'ARCHIVED' ? 'Restore' : s.status === 'ACTIVE' ? 'Disable' : 'Enable';
  if (!window.confirm(`${action} ${s.name}'s account?`)) return;
  try { await api(`/academy/admin/students/${s.id}`,{method:'PATCH',body:JSON.stringify({status:s.status==='ACTIVE'?'DISABLED':'ACTIVE'})}); load(); }
  catch(e){setError(messageFromError(e));}
 }
 async function revoke(enrollmentId:string){
  const reason=window.prompt('Reason for revoking access (required):');
  if(!reason || reason.trim().length<3) return;
  try {await api(`/academy/admin/enrollments/${enrollmentId}/revoke`,{method:'POST',body:JSON.stringify({reason})});load();}
  catch(e){setError(messageFromError(e));}
 }
 return <>
  <PageTitle kicker="STUDENT MANAGEMENT" title="Registered students" description="Manage student accounts and review course progress." action={
   <div className="academy-actions"><button className="primary-button inline-button" onClick={() => openEditor('new')}><Plus size={17}/>Add student</button>
   <Link className="academy-small-button" to="/admin/access">Grant access</Link></div>}/>
  {error && <Alert message={error} onClose={() => setError('')}/>}
  {notice && <Alert success message={notice} onClose={() => setNotice('')}/>}
  {editor && <section className="academy-panel" aria-labelledby="student-editor">
   <h2 id="student-editor">{editor === 'new' ? 'Add a student' : `Edit ${editor.name}`}</h2>
   {editor === 'new' && <p>The student must verify their email before signing in. Share the initial password securely and ask them to change it after signing in.</p>}
   {formError && <Alert message={formError}/>}
   <form key={editor === 'new' ? 'new' : editor.id} className="academy-form-grid" onSubmit={saveStudent}>
    <label>Full name<input name="name" required minLength={2} maxLength={120} defaultValue={editor === 'new' ? '' : editor.name}/></label>
    <label>Email address<input name="email" type="email" required maxLength={254} defaultValue={editor === 'new' ? '' : editor.email}/></label>
    <label>Mobile number<input name="phone" type="tel" maxLength={25} required={editor === 'new'} defaultValue={editor === 'new' ? '' : editor.phone ?? ''}/></label>
    <StudentGenderField required={editor === 'new'} initialValue={editor === 'new' ? '' : editor.gender ?? ''}/>
    {editor === 'new' && <>
     <label>Initial password (12 characters minimum)<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
     <label>Confirm initial password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
    </>}
    <div className="academy-actions academy-wide"><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save student'}</button>
     <button className="academy-small-button" type="button" disabled={busy} onClick={() => setEditor(null)}>Cancel</button></div>
   </form>
  </section>}
  <div className="academy-panel">
   <form className="academy-search" onSubmit={e=>{e.preventDefault();setSearch(q);setPage(1);}}>
    <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by Student ID, name, email or phone" aria-label="Search students"/>
    <button className="primary-button">Search</button>
   </form>
   <label>Student records<select value={archived ? 'archived' : 'current'} onChange={event => {
    setArchived(event.target.value === 'archived'); setPage(1); setSelected(null);
   }}><option value="current">Current accounts</option><option value="archived">Archived accounts</option></select></label>
   <div className="academy-table-scroll"><table className="academy-table">
    <thead><tr><th>Student</th><th>Student ID</th><th>Courses</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>{data.map(s=><tr key={s.id}>
     <td><strong>{s.name}</strong><div className="academy-small">{s.email}</div>{!s.emailVerified && <Badge variant="amber">Email unverified</Badge>}</td>
     <td><code>{s.studentCode}</code></td><td>{s.enrolledCourses.length}</td>
     <td><Link className="academy-small-button" to={`/admin/students/${s.id}`}>Student profile</Link><Badge variant={s.status==='ACTIVE'?'green':'red'}>{s.status}</Badge></td>
     <td><div className="academy-actions">
      <button className="academy-small-button" onClick={()=>setSelected(selected===s.id?null:s.id)}>{selected===s.id?'Hide':'Progress'}</button>
      <button className="academy-small-button" onClick={() => openEditor(s)}>Edit</button>
      <button className="academy-small-button" onClick={() => toggle(s)}>{s.status === 'ARCHIVED' ? 'Restore' : s.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button>
      {s.status !== 'ARCHIVED' && <button className="academy-small-button academy-danger" onClick={() => void archiveStudent(s)}>Archive</button>}
      <button className="academy-small-button academy-danger" disabled={busy} onClick={() => void deleteStudent(s)}>Delete</button>
     </div></td>
    </tr>)}</tbody>
   </table></div>
   {!data.length&&<EmptyState title="No students found" subtitle="Try a different search or switch account filters."/>}
   {pages > 1 && <div className="academy-actions">
    <button className="academy-small-button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button>
    <span>Page {page} of {pages}</span>
    <button className="academy-small-button" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Next</button>
   </div>}
   {selected && data.filter(s=>s.id===selected).map(s=><div className="academy-student-detail" key={s.id}>
    <h3>{s.name} — course progress</h3>
    {s.enrolledCourses.map(e=><div key={e.id} className="academy-progress-card">
     <div className="academy-between"><strong>{e.title}</strong><span>{e.status} · {e.source.replaceAll('_',' ')}</span></div>
     <div className="academy-progress-bg"><div style={{width:`${e.progressPercent}%`}}/></div>
     <small>{e.completed}/{e.total} lessons completed · {e.progressPercent}%</small>
     <button className="academy-small-button" onClick={()=>void showHistory(e.id)}>Access history</button>{e.status!=='ACTIVE'&&<button className="academy-small-button" onClick={()=>void restore(e.id)}>Restore access</button>}{e.expiresAt&&<small>Expires {new Date(e.expiresAt).toLocaleString()}</small>}{e.status==='ACTIVE'&&<button className="academy-small-button academy-danger" onClick={()=>revoke(e.id)}>Revoke access</button>}
    </div>)}
    {!s.enrolledCourses.length&&<p>No course enrollments yet.</p>}
   </div>)}
  </div>
 {history.length>0&&<section className="academy-panel"><h2>Access history</h2><button onClick={()=>setHistory([])}>Close history</button>{history.map(h=><p key={h.id}>{new Date(h.createdAt).toLocaleString()} · {h.action.replaceAll('_',' ')} · {h.actor}<br/>{h.metadata?.reason||h.metadata?.note}</p>)}</section>}
 </>;
}
export function AdminOrders(){const [orders,setOrders]=useState<Order[]>([]);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [status,setStatus]=useState('');const load=useCallback(()=>{api<ApiOne<Order[]>>(`/academy/admin/orders${status?'?status='+status:''}`).then(r=>setOrders(r.data)).catch(e=>setError(messageFromError(e)));},[status]);useEffect(()=>{load()},[load]);
async function approve(order:Order){if(!window.confirm(`Only approve after verifying receipt of ${inr(order.amountPaise)} from ${order.user.name}. Continue?`))return;try{await api(`/academy/admin/orders/${order.id}/approve`,{method:'POST',body:JSON.stringify({note:'Payment independently verified by administrator'})});setNotice('Payment verified and student access activated.');load()}catch(e){setError(messageFromError(e))}}
async function reject(order:Order){const reason=window.prompt('Reason for rejecting this request:');if(!reason||reason.trim().length<3)return;try{await api(`/academy/admin/orders/${order.id}/reject`,{method:'POST',body:JSON.stringify({reason})});setNotice('Payment request rejected.');load()}catch(e){setError(messageFromError(e))}}
return <><PageTitle kicker="PAYMENTS" title="Course payments" description="Track Razorpay purchases and independently verify offline requests."/>{error&&<Alert message={error} onClose={()=>setError('')}/>} {notice&&<Alert message={notice} success/>}<div className="academy-panel"><label>Status filter <select style={{maxWidth:220,marginLeft:12}} value={status} onChange={e=>setStatus(e.target.value)}><option value="">All</option><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="CANCELLED">Cancelled</option></select></label><div className="academy-table-scroll"><table className="academy-table"><thead><tr><th>Student</th><th>Course</th><th>Amount</th><th>Method</th><th>Status</th><th>Action</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><strong>{o.user.name}</strong><div className="academy-small">{o.user.directStudent?.studentCode||o.user.email}</div></td><td>{o.course.title}</td><td>{inr(o.amountPaise)}</td><td>{o.paymentMethod||'—'}<div className="academy-small">{o.paymentReference||''}</div></td><td><Badge variant={o.status==='PAID'?'green':o.status==='PENDING'?'amber':'red'}>{o.status}</Badge></td><td>{o.status==='PENDING' && o.paymentMethod!=='RAZORPAY'?<div className="academy-actions"><button className="academy-small-button" onClick={()=>approve(o)}>Verify & grant</button><button className="academy-small-button academy-danger" onClick={()=>reject(o)}>Reject</button></div>:'—'}</td></tr>)}</tbody></table></div>{!orders.length&&<EmptyState title="No payment records" subtitle="Student requests and manually recorded payments will appear here."/>}</div></>}
