import { courseMediaCredentials } from '../lib/courseMedia';
import type { LessonResource } from '../lib/lessonResources';
import { courseTrackInfo, courseTracks, type CourseTrack } from '../lib/courseTracks';
import { payForCourse } from '../lib/razorpay';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useParams, useSearchParams, useViewTransitionState } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Clock, GraduationCap, PlayCircle, Search, ShoppingBag } from 'lucide-react';
import { Brand, EmptyState, Skeleton, Alert, CourseSkeleton } from '../components/UI';
import { ApiError, api, messageFromError, type ApiList, type ApiOne } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import learningPhoto from '../assets/academy-learning.jpg';
export type Course = {instructor:string|null;learningObjectives:string[];id:string;title:string;description:string|null;previewText:string|null;level:string;category:string|null;track:CourseTrack;thumbnailUrl:string|null;durationHours:number|null;onlineCheckout?:boolean;hasAccess?:boolean;razorpayQuote?:{totalPaise:number;surchargePaise:number|null};pricePaise:number;status:string;lessons?:{id:string;title:string;kind:string;position:number;isPreview:boolean}[]};
export const inr = (p:number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0,maximumFractionDigits:2}).format(p/100);
export function PublicHeader() {
  const { me } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const dashboard = me?.scope === 'PLATFORM' ? '/admin' : '/student';

  useEffect(() => setMenuOpen(false), [pathname]);

  return <header className="academy-public-header" onKeyDown={event => {
    if (event.key === 'Escape' && menuOpen) {
      setMenuOpen(false);
      event.currentTarget.querySelector<HTMLButtonElement>('.academy-menu-toggle')?.focus();
    }
  }}>
    <div className="academy-container academy-header-inner">
      <Link id="site-home-link" to="/" aria-label="Aspireedge home" viewTransition><Brand/></Link>
      <div className="academy-mobile-tools">
      <Link className="academy-mobile-account" to={me ? dashboard : '/login'}>{me ? 'Dashboard' : 'Sign in'}</Link>
      <button type="button" className="academy-menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menuOpen} aria-controls="public-navigation" onClick={() => setMenuOpen(open => !open)}>
        <span className="menu-bars" aria-hidden="true"><i/><i/><i/></span>
      </button>
      </div>
      <nav id="public-navigation" aria-label="Main navigation" className={menuOpen ? 'public-nav-open' : ''}>
        <NavLink viewTransition to="/courses">All courses</NavLink>
        <NavLink viewTransition to="/about">About</NavLink>
        <NavLink viewTransition to="/faq">FAQ</NavLink>
        <NavLink viewTransition to="/contact">Contact</NavLink>
        <NavLink viewTransition to="/verify-certificate">Verify certificate</NavLink>
        <Link className="academy-desktop-account" to={me ? dashboard : '/login'}>{me ? 'My dashboard' : 'Sign in'}</Link>
        {!me && <Link className="primary-button inline-button" to="/register">Get started</Link>}
      </nav>
    </div>
  </header>;
}
export function CourseCard({course, base = '/courses'}:{course:Course; base?: string}){
 const to = base + '/' + course.id;
 const transitioning = useViewTransitionState(to);
 return <Link className="academy-course-card" viewTransition to={to} state={{ courseId: course.id, thumbnailUrl: course.thumbnailUrl }}><div className="academy-cover" style={{ viewTransitionName: course.thumbnailUrl && transitioning ? "course-cover-" + course.id : undefined }}>{course.thumbnailUrl?<img alt="" src={course.thumbnailUrl} loading="lazy"/>:<BookOpen size={42}/>}</div><div className="academy-card-inner"><span className="academy-chip">{course.category || courseTrackInfo(course.track)?.title || 'Online course'} · {course.level.toLowerCase()}</span><h3>{course.title}</h3><p>{course.previewText||course.description||'Learn practical skills with Aspireedge.'}</p><div className="academy-course-bottom"><strong>{course.pricePaise===0?'Free':inr(course.pricePaise)}</strong><span>Explore <ArrowRight size={15}/></span></div></div></Link>}
function TrackLinks({ base, selected }: { base: string; selected?: CourseTrack }) {
  return <nav className="course-track-grid" aria-label="Course types">
    {courseTracks.map(track => <Link key={track.id} className="course-track-link" viewTransition
      aria-current={selected === track.id ? 'page' : undefined} to={`${base}?track=${track.id}`}>
      <BookOpen size={21} aria-hidden="true"/>
      <strong>{track.title}</strong>
      <span>{track.description}</span><ArrowRight className="track-arrow" size={17} aria-hidden="true"/>
    </Link>)}
  </nav>;
}

export function Landing() {
  const { me } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<ApiList<Course>>('/academy/courses?pageSize=6')
      .then(response => setCourses(response.data))
      .catch(() => setError('Courses are temporarily unavailable. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

  return <>
    <PublicHeader/>
    <main>
      <section className="academy-hero">
        <div className="academy-hero-glow" aria-hidden="true"/>
        <div className="academy-container academy-hero-inner">
          <div className="academy-hero-copy">
            <span className="academy-pill">A unit of Aspireedge Pvt. Ltd.</span>
            <h1>Skills that open <em>new doors.</em></h1>
            <p>Build practical, career-focused skills at your own pace and track your progress as you learn.</p>
            <div className="academy-hero-actions">
              <Link to="/courses" className="primary-button inline-button" viewTransition>Explore courses <ArrowRight size={18} aria-hidden="true"/></Link>
              <Link to={me ? (me.scope === 'PLATFORM' ? '/admin' : '/student') : '/register'} className="academy-outline-button">
                {me ? 'Go to dashboard' : 'Create free account'}
              </Link>
            </div>
            <div className="academy-hero-benefits">
              <span><CheckCircle2 size={18}/> Guided learning</span>
              <span><GraduationCap size={18}/> Progress tracking</span>
            </div>
          </div>
          <div className="academy-hero-photo">
            <img src={learningPhoto} alt="A learner studying at a desk with a laptop and notebook" fetchPriority="high"/>
          </div>
        </div>
      </section>
      <section className="academy-container academy-section landing-courses" aria-labelledby="featured-courses" data-reveal>
        <div className="academy-section-heading">
          <h2 id="featured-courses">Explore courses by type</h2>
          <Link to="/courses">View all courses</Link>
        </div>
        <TrackLinks base="/courses"/>
        {loading ? <CourseSkeleton/> : error ? <Alert message={error}/> : courses.length ? (
          <div className="academy-course-grid">{courses.map(course => <CourseCard key={course.id} course={course}/>)}</div>
        ) : <EmptyState title="Courses coming soon" subtitle="Check back for published courses."/>}
      </section>
    </main>
  </>;
}
export function Catalog({ student = false }: { student?: boolean }) {
  const Container = student ? 'section' : 'main';
  const base = student ? '/student/courses' : '/courses';
  const [params, setParams] = useSearchParams();
  const selected = courseTrackInfo(params.get('track'));
  const track = selected?.id ?? '';
  const search = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1));
  const [categories, setCategories] = useState<string[]>([]);
  const [result, setResult] = useState<ApiList<Course> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    api<ApiOne<string[]>>('/academy/categories').then(response => { if (current) setCategories(response.data); }).catch(() => {});
    return () => { current = false; };
  }, []);
  useEffect(() => {
    let current = true;
    setResult(null);
    setError('');
    const query = new URLSearchParams({ pageSize: '12', page: String(page), q: search, category });
    if (track) query.set('track', track);
    api<ApiList<Course>>(`/academy/courses?${query}`)
      .then(response => { if (current) setResult(response); })
      .catch(err => { if (current) setError(messageFromError(err)); });
    return () => { current = false; };
  }, [search, category, track, page]);

  function updateQuery(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }

  return <>{!student && <PublicHeader/>}
    <Container className={student ? 'student-catalog' : 'academy-container academy-section public-content'}>
      <h1 className="catalog-title">{selected?.title ?? 'Explore courses'}</h1>
      <p className="academy-muted">{selected?.description ?? 'Browse all courses or choose a course type.'}</p>
      <TrackLinks base={base} selected={selected?.id}/>
      {selected && <Link className="academy-back" to={base}>View all course types</Link>}
      <form key={search} className="academy-search catalog-search" onSubmit={event => {
        event.preventDefault();
        updateQuery('q', String(new FormData(event.currentTarget).get('q') ?? '').trim());
      }}>
        <Search size={19} aria-hidden="true"/><input name="q" aria-label="Search courses" placeholder="Search by course title or description" defaultValue={search}/>
        <button className="primary-button">Search</button>
      </form>
      <label className="catalog-topic">Topic <select value={category} onChange={event => updateQuery('category', event.target.value)}>
        <option value="">All topics</option>{categories.map(item => <option key={item}>{item}</option>)}
      </select></label>
      {error ? <Alert message={error}/> : !result ? <CourseSkeleton/> : result.data.length ? (
        (selected ? [selected] : courseTracks).map(group => {
          const courses = result.data.filter(course => course.track === group.id);
          return courses.length > 0 && <section key={group.id} className="course-track-results" aria-label={group.title}>
            {!selected && <h2>{group.title}</h2>}
            <div className="academy-course-grid">{courses.map(course => <CourseCard key={course.id} course={course} base={base}/>)}</div>
          </section>;
        })
      ) : <EmptyState title="No courses found" subtitle="Try another course type, topic, or search."/>}
      {result && (result.meta.pages > 1 || page > 1) && <div className="academy-actions">
        <button className="academy-small-button" disabled={page <= 1} onClick={() => updateQuery('page', String(page - 1))}>Previous page</button>
        <span>Page {page} of {Math.max(1, result.meta.pages)}</span>
        <button className="academy-small-button" disabled={page >= result.meta.pages} onClick={() => updateQuery('page', String(page + 1))}>Next page</button>
      </div>}
    </Container>
  </>;
}
export function CourseDetails({ student = false }: { student?: boolean }) {
 const Container = student ? 'section' : 'main';const {id}=useParams();
 const transitioning = useViewTransitionState((student ? "/student/courses/" : "/courses/") + id);
 const { state } = useLocation();
 const transitionThumbnail = state?.courseId === id && typeof state?.thumbnailUrl === "string" ? state.thumbnailUrl : null;
 const {me, loading: authLoading}=useAuth();const navigate=useNavigate();const [course,setCourse]=useState<Course|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [method,setMethod]=useState<'CASH' | 'UPI' | 'RAZORPAY'>('CASH');const companyQr = import.meta.env.VITE_COMPANY_PAYMENT_QR_URL?.trim();const [reference,setReference]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [preview,setPreview]=useState<{title:string;content:string|null;contentUrl:string|null;resources:LessonResource[];kind:string}|null>(null);
 const hasAccess = course?.hasAccess === true;
 useEffect(() => {
  if (authLoading) return;
  const controller = new AbortController();
  setCourse(null);
  setLoading(true);
  setError('');
  setNotice('');
  setPreview(null);
  api<ApiOne<Course>>(`/academy/courses/${id}`, { signal: controller.signal })
   .then(result => { if (!controller.signal.aborted) setCourse(result.data); })
   .catch(error => { if (!controller.signal.aborted) setError(messageFromError(error)); })
   .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
 }, [authLoading, id, me?.user.id]);
 async function order(){if(!me){navigate('/register');return;}if(me.scope!=='STUDENT'){setError('Student account required to request access.');return;}setBusy(true);setError('');try{if(course?.pricePaise===0){await api(`/academy/student/courses/${id}/enroll-free`,{method:'POST'});navigate(`/student/learn/${id}`);return;}await api('/academy/student/orders',{method:'POST',body:JSON.stringify({courseId:id,paymentMethod:method,paymentReference:method === 'UPI' ? reference.trim() : undefined})});setNotice('Request submitted. Your administrator will verify the offline payment and enable course access.');}catch(e){setError(messageFromError(e));}finally{setBusy(false)}}
 async function checkout() {
  if (!me) { navigate('/register'); return; }
  if (me.scope !== 'STUDENT' || !id || busy || !course?.onlineCheckout || !course.razorpayQuote) return;
  setBusy(true); setError('');
  try {
    const payment = await payForCourse(id, course.razorpayQuote.totalPaise);
    if (payment) navigate(`/student/learn/${payment.courseId}`);
  } catch (err) {
    setError(err instanceof ApiError && err.code === 'PAYMENT_NOT_CONFIRMED'
      ? 'Your payment is awaiting confirmation. Check your purchase history before trying to pay again.'
      : messageFromError(err));
  } finally {
    setBusy(false);
  }
 }
 async function viewPreview(lessonId:string){try{const r=await api<ApiOne<{title:string;content:string|null;contentUrl:string|null;resources:LessonResource[];kind:string}>>(`/academy/courses/${id}/preview/${lessonId}`);setPreview(r.data);}catch(e){setError(messageFromError(e));}}
 return <>{!student && <PublicHeader/>}<Container className={student ? "student-catalog" : "academy-container academy-section public-content"}>{(loading || authLoading || !!course && course.id !== id) ? (transitionThumbnail ? <div className="academy-detail-grid"><Skeleton/><aside className="academy-panel academy-checkout"><img className="course-detail-image" src={transitionThumbnail} alt="" style={{ viewTransitionName: transitioning ? "course-cover-" + id : undefined }}/></aside></div> : <Skeleton/>) :error&&!course?<Alert message={error}/>:course&&<><Link to={`${student ? "/student/courses" : "/courses"}?track=${course.track}`} className="academy-back">Back to {courseTrackInfo(course.track)?.title ?? "courses"}</Link><div className="academy-detail-grid"><div><span className="academy-chip">{courseTrackInfo(course.track)?.title ?? 'Online course'} · {course.level}</span>{course.category && <p className="academy-muted">Topic: {course.category}</p>}<h1>{course.title}</h1><p className="academy-lead">{course.description||course.previewText||'Learn at your own pace.'}</p><div className="academy-detail-meta"><span><Clock size={17}/>{course.durationHours||'Self-paced'} {course.durationHours?'hours':''}</span><span><BookOpen size={17}/>{course.lessons?.length||0} lessons</span></div>{course.instructor&&<p><strong>Instructor:</strong> {course.instructor}</p>}{course.learningObjectives?.length>0&&<><h2>What you will learn</h2><ul>{course.learningObjectives.map((objective,index)=><li key={index}>{objective}</li>)}</ul></>}<h2>Course syllabus</h2>{course.lessons?.length ? <div className="academy-module">{course.lessons.map((lesson, index, lessons) => <div key={lesson.id} className="academy-lesson-row">
  <PlayCircle size={16}/>{lesson.kind === 'VIDEO' && `Video ${lessons.slice(0, index + 1).filter(item => item.kind === 'VIDEO').length} · `}{lesson.title}
  {lesson.isPreview && <button className="academy-text-button" onClick={() => viewPreview(lesson.id)}> {lesson.kind === 'VIDEO' ? 'Watch free preview' : 'Free preview'}</button>}
 </div>)}</div> : <p className="academy-muted">Syllabus will be available soon.</p>}{preview&&<div className="academy-panel"><h3>{preview.title}</h3><p style={{whiteSpace:'pre-wrap'}}>{preview.content}</p>{preview.kind === 'VIDEO' && preview.contentUrl && <video controls playsInline preload="metadata" crossOrigin={courseMediaCredentials(preview.contentUrl)} src={preview.contentUrl} style={{ width: '100%', display: 'block' }}/>}{preview.contentUrl&&<a href={preview.contentUrl} target="_blank" rel="noreferrer">Open preview resource</a>}{preview.resources.map(resource => <p key={resource.id}><a href={resource.url} target="_blank" rel="noreferrer">{resource.title} ({resource.kind})</a></p>)}<button onClick={()=>setPreview(null)} className="academy-text-button">Close preview</button></div>}</div><aside className="academy-panel academy-checkout">{course.thumbnailUrl && <img className="course-detail-image" src={course.thumbnailUrl} alt="" style={{ viewTransitionName: transitioning ? "course-cover-" + course.id : undefined }}/>}{hasAccess ? <>
      <h2>You have course access</h2>
      <Link className="primary-button academy-full" to={`/student/learn/${id}`}>Go to course</Link>
    </> : <><h2>{course.pricePaise===0?'Free course':inr(course.pricePaise)}</h2><p>{course.pricePaise===0?'Start learning today, at no cost.':course.onlineCheckout ? 'Pay online for course access, or submit an offline payment request.' : 'Choose a payment method and submit a manual payment request.'}</p>{course.pricePaise!==0&&<><form id="course-access-request" onSubmit={event => {
      event.preventDefault();
      if (method === 'RAZORPAY') void checkout();
      else void order();
    }}>
      <label>Payment method<select value={method} onChange={event => { setMethod(event.target.value as typeof method); setError(''); }}>
        <option value="CASH">Cash</option>
        <option value="UPI">Pay to company QR</option>
        <option value="RAZORPAY">Razorpay</option>
      </select></label>
      {method === 'RAZORPAY' ? (
        course.onlineCheckout && course.razorpayQuote ? <div className="academy-notice">
          {course.razorpayQuote.surchargePaise === null ? <p>Existing Razorpay order</p> : <>
            <p>Course price {inr(course.pricePaise)}</p>
            <p>Razorpay surcharge (3.1%) {inr(course.razorpayQuote.surchargePaise)}</p>
          </>}
          <strong>Total {inr(course.razorpayQuote.totalPaise)}</strong>
        </div> : <p className="academy-notice">Razorpay is currently unavailable. Choose Cash or company QR.</p>
      ) : method === 'CASH' ? <p>Pay cash to the administrator, then request course access.</p> : <>
        {companyQr ? <div className="academy-notice">
          <p>Scan the company QR with your UPI app and pay {inr(course.pricePaise)}.</p>
          <img src={companyQr} alt="Company UPI payment QR code" width={200} height={200} style={{ maxWidth: '100%', height: 'auto' }}/>
        </div> : <p className="academy-notice">Ask the administrator for the company payment QR code.</p>}
        <label>UPI transaction ID<input value={reference} onChange={event => setReference(event.target.value)}
          placeholder="Enter the ID from your payment receipt" required={me?.scope === 'STUDENT'} maxLength={150}/></label>
      </>}
    </form></>}{error&&<Alert message={error}/>} {notice&&<Alert message={notice} success/>}
    <button className="primary-button academy-full" disabled={busy || (method === 'RAZORPAY' && course.pricePaise > 0
        ? !course.onlineCheckout || me?.scope === 'PLATFORM' : !!notice)}
      type={course.pricePaise!==0 ? 'submit' : 'button'} form={course.pricePaise!==0 ? 'course-access-request' : undefined}
      onClick={course.pricePaise===0 ? () => void order() : undefined}>
      {busy?'Submitting...':!me?'Create student account':course.pricePaise===0?'Enroll for free':method==='RAZORPAY'?'Pay with Razorpay':'Request course access'}<ShoppingBag size={18}/>
    </button>{course.pricePaise > 0 && <p className="academy-small">Offline requests require administrator verification. Online purchases activate after Razorpay confirms the payment.</p>}</>}</aside></div></>}</Container></>;
}
