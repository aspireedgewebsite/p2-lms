import { courseMediaCredentials } from '../lib/courseMedia';
import type { LessonResource } from '../lib/lessonResources';
import { courseTracks, type CourseTrack } from '../lib/courseTracks';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Clock, GraduationCap, LockKeyhole, PlayCircle, ShoppingBag } from 'lucide-react';
import { Alert, EmptyState, PageTitle, Skeleton } from '../components/UI';
import { api, messageFromError, type ApiOne } from '../lib/api';
import { inr } from './Public';
import { useAuth } from '../context/AuthContext';
import maleLearningPhoto from '../assets/academy-learning-male.jpg';
import femaleLearningPhoto from '../assets/academy-learning.jpg';
import './StudentDashboard.css';
type StudentCourse = {id:string;track:CourseTrack;title:string;thumbnailUrl:string|null;accessStatus:string;source:string;enrolledAt:string;totalLessons:number;completedLessons:number;progressPercent:number};
type Dash = {studentCode:string;courses:StudentCourse[];pendingOrders:number;activeCourses:number;completedCourses:number};
type Lesson = {id:string;title:string;kind:'TEXT'|'VIDEO'|'LINK'|'PDF';content:string|null;contentUrl:string|null;resources:LessonResource[];isPreview:boolean};
type FullCourse = {lastLessonId:string|null;course:{id:string;title:string;description:string|null;lessons:Lesson[]};progress:{lessonId:string;completedAt:string}[]};
type Order = {id:string;amountPaise:number;status:string;paymentMethod:string|null;createdAt:string;course:{title:string}};
function LearningCard({ course }: { course: StudentCourse }) {
  const active = course.accessStatus === 'ACTIVE';
  const complete = course.totalLessons > 0 && course.completedLessons >= course.totalLessons;
  const progress = Math.max(0, Math.min(100, course.progressPercent));

  return <article className="learning-card">
    <div className="learning-cover" aria-hidden="true">
      <BookOpen size={40}/>
      {course.thumbnailUrl && <img src={course.thumbnailUrl} alt="" loading="lazy"
        onError={event => { event.currentTarget.hidden = true; }}/>}
    </div>
    <div className="learning-card-body">
      <span className="learning-course-status">
        {active ? (complete ? 'Completed' : 'Active access') : 'Access inactive'}
      </span>
      <h4>{course.title}</h4>
      <div className="learning-card-progress">
        <div className="learning-progress-label">
          <span>{course.completedLessons} of {course.totalLessons} lessons</span>
          <strong>{progress}%</strong>
        </div>
        <div className="learning-progress-track" role="progressbar" aria-label={`${course.title} progress`} aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }}/>
        </div>
      </div>
      {active ? <Link className="learning-card-link" to={`/student/learn/${course.id}`}>
        <PlayCircle size={18} aria-hidden="true"/>
        {complete ? 'Review course' : course.completedLessons ? 'Continue course' : 'Open course'}
      </Link> : <p className="learning-access-note"><LockKeyhole size={16} aria-hidden="true"/> Your progress is saved.</p>}
    </div>
  </article>;
}

export function StudentDashboard() {
  const { me } = useAuth();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<ApiOne<Dash>>('/academy/student/dashboard')
      .then(response => setData(response.data))
      .catch(err => setError(messageFromError(err)));
  }, []);

  const gender = me?.user.directStudent?.gender;
  const learningPhoto = gender === 'MALE' ? maleLearningPhoto : gender === 'FEMALE' ? femaleLearningPhoto : null;
  const name = me?.user.name.trim().split(/\s+/)[0];
  const activeCourses = data?.courses.filter(course => course.accessStatus === 'ACTIVE') ?? [];
  const resume = activeCourses.find(course => course.progressPercent > 0 && course.progressPercent < 100)
    ?? activeCourses.find(course => course.progressPercent < 100) ?? activeCourses[0];

  return <div className="learning-dashboard">
    <section className="learning-hero" aria-labelledby="learning-welcome">
      {learningPhoto ? <img src={learningPhoto} alt="" className="learning-hero-image"/> : <div className="learning-hero-art" aria-hidden="true"><GraduationCap/></div>}
      <div className="learning-hero-copy">
        {data && <span className="learning-id">Student ID <strong>{data.studentCode}</strong></span>}
        <h1 id="learning-welcome">{name ? `Welcome back, ${name}` : 'My learning'}</h1>
        <p>{resume ? `Pick up where you left off in ${resume.title}.` : 'Find a course and keep track of your progress in one place.'}</p>
        {data && <Link className="learning-hero-action" to={resume ? `/student/learn/${resume.id}` : '/student/courses'}>
          {resume ? <PlayCircle size={20} aria-hidden="true"/> : <BookOpen size={20} aria-hidden="true"/>}
          {resume ? (resume.progressPercent >= 100 ? 'Review course' : resume.completedLessons ? 'Resume learning' : 'Open course') : 'Explore courses'}
        </Link>}
      </div>
    </section>
    {error && <Alert message={error}/>}
    {!data && !error && <Skeleton/>}
    {data && <>
      <dl className="learning-stats" aria-label="Learning activity">
        <div><BookOpen aria-hidden="true"/><dt>Active courses</dt><dd>{data.activeCourses}</dd></div>
        <div><GraduationCap aria-hidden="true"/><dt>Completed courses</dt><dd>{data.completedCourses}</dd></div>
        <div><Clock aria-hidden="true"/><dt>Pending payments</dt><dd>{data.pendingOrders}</dd></div>
      </dl>
      <section className="learning-courses" aria-labelledby="learning-courses-heading">
        <div className="learning-section-heading">
          <h2 id="learning-courses-heading">My courses</h2>
          <Link to="/student/courses">Browse catalog</Link>
        </div>
        {data.courses.length ? courseTracks.map(track => {
          const courses = data.courses.filter(course => course.track === track.id);
          return courses.length > 0 && <section key={track.id} className="course-track-results" aria-label={track.title}>
            <h3>{track.title}</h3>
            <div className="learning-grid">{courses.map(course => <LearningCard key={course.id} course={course}/>)}</div>
          </section>;
        }) : <div className="learning-empty">
          <GraduationCap size={34} aria-hidden="true"/>
          <h3>Your learning starts here</h3>
          <p>Enroll from the catalog or share your Student ID with an administrator for manual access.</p>
        </div>}
      </section>
    </>}
  </div>;
}
export function StudentLearn(){const {id}=useParams();const [data,setData]=useState<FullCourse|null>(null);const [error,setError]=useState('');const [selected,setSelected]=useState<string|null>(null);const [busy,setBusy]=useState(false);
const load=useCallback(async()=>{try{const r=await api<ApiOne<FullCourse>>(`/academy/student/courses/${id}`);setData(r.data);setSelected(current=>(current&&r.data.course.lessons.some(l=>l.id===current)?current:null)||(r.data.course.lessons.some(l=>l.id===r.data.lastLessonId)?r.data.lastLessonId:null)||r.data.course.lessons.find(l=>!r.data.progress.some(p=>p.lessonId===l.id))?.id||r.data.course.lessons[0]?.id||null)}catch(e){setError(messageFromError(e))}},[id]);useEffect(()=>{void load()},[load]);
useEffect(()=>{if(selected&&data?.course.id===id)void api(`/academy/student/lessons/${selected}/visit`,{method:'POST'}).catch(e=>setError(messageFromError(e)));},[selected,id,data?.course.id]);
const lessons=data?.course.lessons||[];const lesson=lessons.find(l=>l.id===selected);const selectedIndex=lessons.findIndex(l=>l.id===selected);const completed=new Set(data?.progress.map(p=>p.lessonId));const total=lessons.length;
async function complete(){if(!lesson)return;setBusy(true);setError('');try{await api(`/academy/student/lessons/${lesson.id}/complete`,{method:'POST'});await load()}catch(e){setError(messageFromError(e))}finally{setBusy(false)}}
return <><PageTitle kicker="COURSE PLAYER" title={data?.course.title||'Loading course…'} description="Read, learn and mark lessons complete to track your progress." action={<Link to="/student" className="academy-small-button">← My courses</Link>}/>{error&&<Alert message={error}/>} {!data&&!error?<Skeleton/>:data&&<div className="academy-player"><aside className="academy-panel academy-player-sidebar"><strong>Course lessons</strong><p className="academy-muted">{completed.size}/{total} completed</p><div className="academy-progress-bg"><div style={{width:`${total?Math.round(completed.size/total*100):0}%`}}/></div>{lessons.map((item, index) => <button key={item.id} className={`academy-player-lesson ${selected === item.id ? 'selected' : ''}`} aria-current={selected === item.id ? "step" : undefined} onClick={() => setSelected(item.id)}>
  {completed.has(item.id) ? <CheckCircle2 size={17}/> : <PlayCircle size={17}/>}
  <span>{item.kind === 'VIDEO' && `Video ${lessons.slice(0, index + 1).filter(lesson => lesson.kind === 'VIDEO').length} · `}{item.title}</span>
 </button>)}</aside><section className="academy-panel academy-player-content">{lesson?<><span className="academy-chip">{lesson.kind} LESSON</span><h2>{lesson.title}</h2><p style={{whiteSpace:'pre-wrap'}}>{lesson.content||'Your instructor has not added written notes for this lesson yet.'}</p>{lesson.kind==='VIDEO'&&lesson.contentUrl&&<video controls playsInline preload="metadata" crossOrigin={courseMediaCredentials(lesson.contentUrl)} src={lesson.contentUrl} style={{width:'100%'}}/>}{lesson.contentUrl&&<div className="academy-notice"><a href={lesson.contentUrl} target="_blank" rel="noreferrer">Open learning resource <ArrowRight size={16} style={{display:'inline'}}/></a><p className="academy-small">Uploaded resources require active course access unless marked as a public preview.</p></div>}{!!lesson.resources.length && <section className="academy-module"><h3>Lesson resources</h3><ul>
  {lesson.resources.map(resource => <li key={resource.id}><a href={resource.url} target="_blank" rel="noreferrer">{resource.title} ({resource.kind})</a></li>)}
 </ul></section>}<div className="academy-player-actions"><button className="academy-small-button" disabled={selectedIndex<=0} onClick={()=>setSelected(lessons[selectedIndex-1]?.id||null)}>Previous lesson</button><button className="academy-small-button" disabled={selectedIndex>=lessons.length-1} onClick={()=>setSelected(lessons[selectedIndex+1]?.id||null)}>Next lesson</button>{completed.has(lesson.id)?<span className="academy-complete"><CheckCircle2 size={18}/> Completed</span>:<button disabled={busy} className="primary-button inline-button" onClick={complete}>{busy?'Saving…':'Mark lesson completed'}<CheckCircle2 size={18}/></button>}</div></>:<div className="academy-muted"><LockKeyhole/> No lessons have been added to this course yet.</div>}</section></div>}</>}
export function StudentOrders(){const [orders,setOrders]=useState<Order[]>([]);const [error,setError]=useState('');useEffect(()=>{api<ApiOne<Order[]>>('/academy/student/orders').then(r=>setOrders(r.data)).catch(e=>setError(messageFromError(e)));},[]);return <><PageTitle kicker="MY PAYMENTS" title="Purchase requests and history" description="Track Razorpay purchases and offline payment requests." action={<Link to="/student/courses" className="primary-button inline-button">Explore courses <ShoppingBag size={17}/></Link>}/>{error&&<Alert message={error}/>}<div className="academy-panel"><div className="academy-table-scroll"><table className="academy-table"><thead><tr><th>Course</th><th>Amount</th><th>Method</th><th>Requested</th><th>Status</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td>{o.course.title}</td><td>{inr(o.amountPaise)}</td><td>{o.paymentMethod||'—'}</td><td>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td><td><span className="academy-chip">{o.status}</span></td></tr>)}</tbody></table></div>{!orders.length&&<EmptyState title="No purchases yet" subtitle="Your purchase requests will appear here."/>}</div></>}
