import { courseTrackInfo, courseTracks, type CourseTrack } from '../lib/courseTracks';
import { payForCourse } from '../lib/razorpay';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Clock, GraduationCap, Menu, PlayCircle, Search, ShoppingBag, X } from 'lucide-react';
import { Brand, EmptyState, Skeleton, Alert } from '../components/UI';
import { ApiError, api, messageFromError, type ApiList, type ApiOne } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import learningPhoto from '../assets/academy-learning.jpg';
export type Course = {instructor:string|null;learningObjectives:string[];id:string;title:string;description:string|null;previewText:string|null;level:string;category:string|null;track:CourseTrack;thumbnailUrl:string|null;durationHours:number|null;onlineCheckout?:boolean;pricePaise:number;status:string;modules?:{id:string;title:string;position:number;lessons:{id:string;title:string;kind:string;position:number;isPreview:boolean}[]}[]};
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
      <Link to="/"><Brand/></Link>
      <div className="academy-mobile-tools">
      <Link className="academy-mobile-account" to={me ? dashboard : '/login'}>{me ? 'Dashboard' : 'Sign in'}</Link>
      <button type="button" className="academy-menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menuOpen} aria-controls="public-navigation" onClick={() => setMenuOpen(open => !open)}>
        {menuOpen ? <X size={22}/> : <Menu size={22}/>}
      </button>
      </div>
      <nav id="public-navigation" aria-label="Main navigation" className={menuOpen ? 'public-nav-open' : ''}>
        <NavLink to="/courses">All courses</NavLink>
        <NavLink to="/about">About</NavLink>
        <NavLink to="/faq">FAQ</NavLink>
        <NavLink to="/contact">Contact</NavLink>
        <NavLink to="/verify-certificate">Verify certificate</NavLink>
        <Link className="academy-desktop-account" to={me ? dashboard : '/login'}>{me ? 'My dashboard' : 'Sign in'}</Link>
        {!me && <Link className="primary-button inline-button" to="/register">Get started</Link>}
      </nav>
    </div>
  </header>;
}
export function PublicFooter() {
  return <footer className="academy-footer">
    <div className="academy-container academy-footer-inner">
      <Link to="/"><Brand/></Link>
      <span>© {new Date().getFullYear()} Aspireedge Pvt. Ltd.</span>
      <nav aria-label="Footer navigation">
        <Link to="/about">About</Link>
        <Link to="/faq">FAQ</Link>
        <Link to="/contact">Contact</Link>
      </nav>
    </div>
  </footer>;
}
export function CourseCard({course, base = '/courses'}:{course:Course; base?: string}){return <Link className="academy-course-card" to={`${base}/${course.id}`}><div className="academy-cover">{course.thumbnailUrl?<img alt="" src={course.thumbnailUrl} loading="lazy"/>:<BookOpen size={42}/>}</div><div className="academy-card-inner"><span className="academy-chip">{course.category || courseTrackInfo(course.track)?.title || 'Online course'} · {course.level.toLowerCase()}</span><h3>{course.title}</h3><p>{course.previewText||course.description||'Learn practical skills with Aspireedge.'}</p><div className="academy-course-bottom"><strong>{course.pricePaise===0?'Free':inr(course.pricePaise)}</strong><span>Explore <ArrowRight size={15}/></span></div></div></Link>}
function TrackLinks({ base, selected }: { base: string; selected?: CourseTrack }) {
  return <nav className="course-track-grid" aria-label="Course types">
    {courseTracks.map(track => <Link key={track.id} className="course-track-link"
      aria-current={selected === track.id ? 'page' : undefined} to={`${base}?track=${track.id}`}>
      <BookOpen size={21} aria-hidden="true"/>
      <strong>{track.title}</strong>
      <span>{track.description}</span>
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
              <Link to="/courses" className="primary-button inline-button">Explore courses</Link>
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
      <section className="academy-container academy-section" aria-labelledby="featured-courses">
        <div className="academy-section-heading">
          <h2 id="featured-courses">Explore courses by type</h2>
          <Link to="/courses">View all courses</Link>
        </div>
        <TrackLinks base="/courses"/>
        {loading ? <Skeleton/> : error ? <Alert message={error}/> : courses.length ? (
          <div className="academy-course-grid">{courses.map(course => <CourseCard key={course.id} course={course}/>)}</div>
        ) : <EmptyState title="Courses coming soon" subtitle="Check back for published courses."/>}
      </section>
    </main>
    <PublicFooter/>
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
      <h1>{selected?.title ?? 'Explore courses'}</h1>
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
      {error ? <Alert message={error}/> : !result ? <Skeleton/> : result.data.length ? (
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
    {!student && <PublicFooter/>}
  </>;
}
export function CourseDetails({ student = false }: { student?: boolean }) {
 const Container = student ? 'section' : 'main';const {id}=useParams();const {me}=useAuth();const navigate=useNavigate();const [course,setCourse]=useState<Course|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [method,setMethod]=useState('UPI');const [reference,setReference]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [preview,setPreview]=useState<{title:string;content:string|null;contentUrl:string|null;kind:string}|null>(null);const [hasAccess,setHasAccess]=useState(false);
 useEffect(()=>{setLoading(true);api<ApiOne<Course>>(`/academy/courses/${id}`).then(r=>setCourse(r.data)).catch(e=>setError(messageFromError(e))).finally(()=>setLoading(false));},[id]);
 useEffect(()=>{if(me?.scope==='STUDENT'){api<ApiOne<{courses:{id:string;accessStatus:string}[]}>>('/academy/student/dashboard').then(r=>setHasAccess(r.data.courses.some(c=>c.id===id&&c.accessStatus==='ACTIVE'))).catch(()=>{});}else setHasAccess(false);},[me,id]);
 async function order(){if(hasAccess){navigate(`/student/learn/${id}`);return;}if(!me){navigate('/register');return;}if(me.scope!=='STUDENT'){setError('Student account required to request access.');return;}setBusy(true);setError('');try{if(course?.pricePaise===0){await api(`/academy/student/courses/${id}/enroll-free`,{method:'POST'});navigate(`/student/learn/${id}`);return;}await api('/academy/student/orders',{method:'POST',body:JSON.stringify({courseId:id,paymentMethod:method,paymentReference:reference})});setNotice('Request submitted. Your administrator will verify the offline payment and enable course access.');}catch(e){setError(messageFromError(e));}finally{setBusy(false)}}
 async function checkout() {
  if (!me) { navigate('/register'); return; }
  if (me.scope !== 'STUDENT' || !id || busy) return;
  setBusy(true); setError('');
  try {
    const payment = await payForCourse(id);
    if (payment) navigate(`/student/learn/${payment.courseId}`);
  } catch (err) {
    setError(err instanceof ApiError && err.code === 'PAYMENT_NOT_CONFIRMED'
      ? 'Your payment is awaiting confirmation. Check your purchase history before trying to pay again.'
      : messageFromError(err));
  } finally {
    setBusy(false);
  }
 }
 async function viewPreview(lessonId:string){try{const r=await api<ApiOne<{title:string;content:string|null;contentUrl:string|null;kind:string}>>(`/academy/courses/${id}/preview/${lessonId}`);setPreview(r.data);}catch(e){setError(messageFromError(e));}}
 return <>{!student && <PublicHeader/>}<Container className={student ? "student-catalog" : "academy-container academy-section public-content"}>{loading?<Skeleton/>:error&&!course?<Alert message={error}/>:course&&<><Link to={`${student ? "/student/courses" : "/courses"}?track=${course.track}`} className="academy-back">Back to {courseTrackInfo(course.track)?.title ?? "courses"}</Link><div className="academy-detail-grid"><div><span className="academy-chip">{courseTrackInfo(course.track)?.title ?? 'Online course'} · {course.level}</span>{course.category && <p className="academy-muted">Topic: {course.category}</p>}<h1>{course.title}</h1><p className="academy-lead">{course.description||course.previewText||'Learn at your own pace.'}</p><div className="academy-detail-meta"><span><Clock size={17}/>{course.durationHours||'Self-paced'} {course.durationHours?'hours':''}</span><span><BookOpen size={17}/>{course.modules?.reduce((n,m)=>n+m.lessons.length,0)||0} lessons</span></div>{course.instructor&&<p><strong>Instructor:</strong> {course.instructor}</p>}{course.learningObjectives?.length>0&&<><h2>What you will learn</h2><ul>{course.learningObjectives.map((objective,index)=><li key={index}>{objective}</li>)}</ul></>}<h2>Course syllabus</h2>{course.modules?.length?course.modules.map((m,i)=><div className="academy-module" key={m.id}><strong>Module {i+1}: {m.title}</strong>{m.lessons.length?m.lessons.map(l=><div key={l.id} className="academy-lesson-row"><PlayCircle size={16}/>{l.title}{l.isPreview&&<button className="academy-text-button" onClick={()=>viewPreview(l.id)}>Preview</button>}</div>):<p>Lessons coming soon</p>}</div>):<p className="academy-muted">Syllabus will be available soon.</p>}{preview&&<div className="academy-panel"><h3>{preview.title}</h3><p style={{whiteSpace:'pre-wrap'}}>{preview.content}</p>{preview.contentUrl&&<a href={preview.contentUrl} target="_blank" rel="noreferrer">Open preview resource</a>}<button onClick={()=>setPreview(null)} className="academy-text-button">Close preview</button></div>}</div><aside className="academy-panel academy-checkout"><h2>{course.pricePaise===0?'Free course':inr(course.pricePaise)}</h2><p>{course.pricePaise===0?'Start learning today, at no cost.':course.onlineCheckout ? 'Pay online for course access, or submit an offline payment request.' : 'Choose a payment method and submit a manual payment request.'}</p>{course.pricePaise!==0&&!hasAccess&&<>{course.onlineCheckout && <button className="primary-button academy-full" disabled={busy || me?.scope === 'PLATFORM'} onClick={() => void checkout()}>
      {busy ? 'Please wait…' : me ? 'Pay with Razorpay' : 'Create account to pay online'}
    </button>}
    <div className="academy-notice">For offline payment, ask the administrator for verified payment instructions.</div><label>Offline payment method<select value={method} onChange={e=>setMethod(e.target.value)}><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></label><label>Transaction reference (optional)<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Reference after payment"/></label></>}{error&&<Alert message={error}/>} {notice&&<Alert message={notice} success/>}<button className="primary-button academy-full" disabled={busy||!!notice} onClick={order}>{busy?'Submitting…':hasAccess?'Go to course':!me?'Create student account':course.pricePaise===0?'Enroll for free':'Request course access'}<ShoppingBag size={18}/></button><p className="academy-small">Offline requests require administrator verification. Online purchases activate after Razorpay confirms the payment.</p></aside></div></>}</Container>{!student && <PublicFooter/>}</>;
}
