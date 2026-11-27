import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, API_URL, messageFromError, type ApiOne, type ApiList } from '../lib/api';
import { Alert, PageTitle } from '../components/UI';
import { PublicFooter, PublicHeader } from './Public';
type Template = { id: string; name: string; brandName: string; signatory: string; requireAllLessons: boolean; requireQuizzes: boolean; requireAssignments: boolean; assignmentPassPercent: number };
type Certificate = { id: string; snapshot: { studentName: string; courseTitle: string; brandName: string }; issuedAt: string; revokedAt: string | null };
type Course = { id: string; title: string; certificateTemplateId: string | null };
function CertificateLinks({ certificate }: { certificate: Certificate }) {
  return <><Link to={`/verify-certificate/${certificate.id}`}>Verify certificate</Link>{!certificate.revokedAt && <> · <a href={`${API_URL}/certificates/${certificate.id}/pdf`}>Download PDF</a></>}</>;
}
export function AdminCertificates() {
  const [data, setData] = useState<{ templates: Template[]; certificates: Certificate[] }>({ templates: [], certificates: [] });
  const [courses, setCourses] = useState<Course[]>([]), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Certificate | null>(null);
  async function load() { const [a, c] = await Promise.all([api<ApiOne<typeof data>>('/certificates/admin'), api<ApiList<Course>>('/academy/admin/courses?pageSize=100')]); setData(a.data); setCourses(c.data); }
  useEffect(() => { void load().catch(e => setError(messageFromError(e))); }, []);
  async function run(fn: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try { await fn(); await load(); } catch (e) { setError(messageFromError(e)); } finally { setBusy(false); } }
  function createTemplate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
    void run(async () => { await api('/certificates/admin/templates', { method: 'POST', body: JSON.stringify({ name: f.get('name'), brandName: f.get('brandName'), signatory: f.get('signatory'), accentColor: f.get('accentColor'), requireAllLessons: f.has('lessons'), requireQuizzes: f.has('quizzes'), requireAssignments: f.has('assignments'), assignmentPassPercent: Number(f.get('pass')) }) }); form.reset(); setNotice('Template created. Assign it to a course below.'); });
  }
  function issue(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = new FormData(form);
    setIssued(null);
    void run(async () => {
      const { data: record } = await api<ApiOne<Certificate>>('/certificates/admin/issue-manual', {
        method: 'POST', body: JSON.stringify({ student: fields.get('student'), courseId: fields.get('course') }),
      });
      setIssued(record);
      form.reset();
    });
  }
  return <><PageTitle kicker="CERTIFICATES" title="Certificates" description="Issue a PDF certificate directly to a registered student."/>
    {error && <Alert message={error}/>} {notice && <Alert success message={notice}/>}
    <section className="academy-panel">
      <h2>Issue certificate</h2>
      <form className="academy-form-grid" onSubmit={issue}>
        <label>Student ID or email<input name="student" required maxLength={254}/></label>
        <label>Course<select name="course" required defaultValue="">
          <option value="" disabled>Select course</option>
          {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select></label>
        <div className="academy-wide"><button className="primary-button" disabled={busy || !courses.length}>Issue certificate</button></div>
      </form>
      {issued && <div className="academy-notice" role="status">
        <p>Certificate available for {issued.snapshot.studentName} · {issued.snapshot.courseTitle}</p>
        <CertificateLinks certificate={issued}/>
      </div>}
    </section>
    <details className="academy-panel"><summary><strong>Template settings</strong></summary>
    <section className="academy-panel"><h2>Create template</h2><p>New templates preserve the rules and branding on previously issued certificates.</p><form className="auth-form" onSubmit={createTemplate}>
      <label>Template name<input name="name" required minLength={3} maxLength={80}/></label><label>Brand name<input name="brandName" required defaultValue="Aspireedge Pvt. Ltd." maxLength={80}/></label><label>Authorized signatory<input name="signatory" required maxLength={80}/></label><label>Accent color<input type="color" name="accentColor" defaultValue="#3456dc"/></label>
      <label><span><input type="checkbox" name="lessons" defaultChecked/> Require all current lessons</span></label><label><span><input type="checkbox" name="quizzes" defaultChecked/> Require all published quizzes passed</span></label><label><span><input type="checkbox" name="assignments" defaultChecked/> Require all published assignments passed</span></label><label>Assignment pass percentage<input type="number" name="pass" min={1} max={100} defaultValue={70} required/></label><button className="primary-button" disabled={busy}>Create template</button>
    </form></section>
    <section className="academy-panel"><h2>Course requirements</h2><p>Assignments use the latest submission and its latest evaluation. A course with no lessons cannot meet the all-lessons requirement.</p><form className="auth-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => { await api(`/certificates/admin/courses/${f.get('course')}/template`, { method: 'PUT', body: JSON.stringify({ templateId: f.get('template') }) }); setNotice('Course certificate requirements saved.'); }); }}>
      <label>Course<select name="course" required defaultValue=""><option value="" disabled>Select course</option>{courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Template<select name="template" required defaultValue=""><option value="" disabled>Select template</option>{data.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button disabled={busy} className="primary-button">Assign template</button>
    </form>{courses.filter(c => c.certificateTemplateId).map(c => <p key={c.id}>{c.title}: {data.templates.find(t => t.id === c.certificateTemplateId)?.name}</p>)}</section></details>
    <details className="academy-panel"><summary><strong>Issued certificates ({data.certificates.length})</strong></summary><p>Showing the latest 500 certificates. Revocation stops downloads and updates public verification immediately.</p>{data.certificates.map(c => <article className="academy-module" key={c.id}><h3>{c.snapshot.studentName} · {c.snapshot.courseTitle}</h3><p>{new Date(c.issuedAt).toLocaleDateString()} · {c.revokedAt ? 'Revoked' : 'Valid'}</p><CertificateLinks certificate={c}/>{!c.revokedAt && <form className="auth-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(async () => { await api(`/certificates/admin/${c.id}/revoke`, { method: 'POST', body: JSON.stringify({ reason: f.get('reason') }) }); setNotice('Certificate revoked.'); }); }}><label>Revocation reason<input name="reason" required minLength={10} maxLength={1000}/></label><button disabled={busy}>Revoke certificate</button></form>}</article>)}</details>
  </>;
}
export function StudentCertificates() {
  const [records, setRecords] = useState<Certificate[]>([]), [error, setError] = useState('');
  useEffect(() => { void api<ApiOne<Certificate[]>>('/certificates/student').then(r => setRecords(r.data)).catch(e => setError(messageFromError(e))); }, []);
  return <><PageTitle kicker="ACHIEVEMENTS" title="My certificates" description="Download your certificates and share their public verification links."/>{error && <Alert message={error}/>}<section className="academy-panel">{!records.length && <p>No certificates issued yet. Complete your course requirements and contact the administrator.</p>}{records.map(c => <article className="academy-module" key={c.id}><h2>{c.snapshot.courseTitle}</h2><p>{new Date(c.issuedAt).toLocaleDateString()} · {c.revokedAt ? 'Revoked' : 'Valid'}</p><CertificateLinks certificate={c}/></article>)}</section></>;
}
export function VerifyCertificate() {
  const { id } = useParams(); const [lookup, setLookup] = useState(id || '');
  const [record, setRecord] = useState<{ id: string; status: string; studentName: string; courseTitle: string; brandName: string; issuedAt: string } | null>(null), [error, setError] = useState('');
  async function verify(value: string) { setRecord(null); setError(''); try { setRecord((await api<ApiOne<NonNullable<typeof record>>>(`/certificates/verify/${encodeURIComponent(value.trim())}`)).data); } catch (e) { setError(messageFromError(e)); } }
  useEffect(() => { if (id) void verify(id); }, [id]);
  return <><PublicHeader/><main className="academy-container academy-section public-content"><h1>Verify a certificate</h1><p>Enter the unique certificate ID or scan the QR code on the PDF.</p><form className="auth-form public-verification-form" onSubmit={e => { e.preventDefault(); void verify(lookup); }}><label>Certificate ID<input value={lookup} onChange={e => setLookup(e.target.value)} required/></label><button className="primary-button">Verify certificate</button></form>{error && <Alert message={error}/>} {record && <section className="academy-panel"><h2>{record.status === 'VALID' ? 'Valid certificate' : 'Certificate revoked'}</h2><p>{record.studentName}</p><h3>{record.courseTitle}</h3><p>{record.brandName} · Issued {new Date(record.issuedAt).toLocaleDateString()}</p><p>Certificate ID: {record.id}</p>{record.status === 'REVOKED' && <p>This certificate is no longer valid.</p>}</section>}</main><PublicFooter/></>;
}
