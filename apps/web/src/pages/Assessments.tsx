import { FormEvent, useEffect, useState } from 'react';
import { api, API_URL, messageFromError, type ApiOne, type ApiList } from '../lib/api';
import { Alert, PageTitle } from '../components/UI';
type Question = { id: string; prompt: string; kind: 'MCQ' | 'MULTI' | 'TRUE_FALSE'; choices: string[]; correctOptions: number[] };
type Quiz = { id: string; courseId: string; title: string; durationMinutes: number; maxAttempts: number; passPercent: number; published: boolean; assignmentOnly: boolean; studentAssignments?: {userId: string}[]; questions: Question[]; course: {title: string}; attempts?: {id: string; number: number; status: string; score: number | null; passed: boolean; expiresAt: string}[] };
type Review = {id: string; score: number; feedback: string; createdAt: string};
type Submission = {id: string; text: string | null; fileId: string | null; submittedAt: string; user?: {name: string; email: string}; reviews: Review[]};
type Assignment = {id: string; courseId: string; title: string; instructions: string; dueAt: string | null; maxScore: number; published: boolean; course: {title: string}; submissions?: Submission[]};
type AssessmentData = {quizzes: Quiz[]; assignments: Assignment[]; bank?: {id: string; question: Question}[]};
type Student = { userId: string; name: string; email: string; status: string };
type AssignableQuiz = Pick<Quiz, 'id' | 'title' | 'course' | 'studentAssignments'>;

function AssignQuizzes() {
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student>();
  const [quizzes, setQuizzes] = useState<AssignableQuiz[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); } catch (error) { setError(messageFromError(error)); } finally { setBusy(false); }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    setStudent(undefined);
    setStudents([]);
    await run(async () => {
      const result = await api<ApiList<Student>>(`/academy/admin/students?pageSize=20&q=${encodeURIComponent(query.trim())}`);
      const active = result.data.filter(candidate => candidate.status === 'ACTIVE');
      setStudents(active);
      if (!active.length) setNotice('No active students matched your search.');
    });
  }

  async function choose(candidate: Student) {
    setStudent(undefined);
    setSelected([]);
    await run(async () => {
      const result = await api<ApiOne<AssignableQuiz[]>>(`/assessments/admin/students/${candidate.userId}/quizzes`);
      setQuizzes(result.data);
      setStudent(candidate);
    });
  }

  async function assign(event: FormEvent) {
    event.preventDefault();
    if (!student) return;
    await run(async () => {
      const result = await api<ApiOne<{count: number}>>(`/assessments/admin/students/${student.userId}/quizzes`, {
        method: 'POST', body: JSON.stringify({ quizIds: selected }),
      });
      setQuizzes(quizzes.map(quiz => selected.includes(quiz.id) ? { ...quiz, studentAssignments: [{ userId: student.userId }] } : quiz));
      setSelected([]);
      setNotice(`${result.data.count} new quiz assignments saved for ${student.name}.`);
    });
  }

  return <section className="academy-panel" id="assign-quizzes">
    <h2>Assign quizzes to a student</h2>
    <p>Find a student, then select published quizzes from their active courses.</p>
    <form className="assessment-search" onSubmit={search}>
      <label>Student name, email, or ID<input required value={query} onChange={event => setQuery(event.target.value)}/></label>
      <button className="primary-button" disabled={busy}>Find student</button>
    </form>
    {error && <Alert message={error}/>}
    {notice && <Alert success message={notice}/>}
    {students.map(candidate => <div className="assessment-row" key={candidate.userId}>
      <span><strong>{candidate.name}</strong> · {candidate.email}</span>
      <button className="academy-small-button" disabled={busy || student?.userId === candidate.userId} onClick={() => void choose(candidate)}>
        {student?.userId === candidate.userId ? 'Selected' : 'Select student'}
      </button>
    </div>)}
    {student && <form onSubmit={assign} className="auth-form assessment-selection">
      <fieldset>
        <legend>Quizzes for {student.name}</legend>
        {!quizzes.length && <p>There are no published quizzes in this student’s active courses.</p>}
        {quizzes.map(quiz => {
          const assigned = !!quiz.studentAssignments?.length;
          return <label key={quiz.id} className="assessment-choice">
            <input type="checkbox" checked={assigned || selected.includes(quiz.id)} disabled={assigned || busy || selected.length >= 100 && !selected.includes(quiz.id)}
              onChange={event => setSelected(event.target.checked ? [...selected, quiz.id] : selected.filter(id => id !== quiz.id))}/>
            <span>{quiz.title}<small>{quiz.course.title}{assigned && ' · Assigned'}</small></span>
          </label>;
        })}
      </fieldset>
      <button className="primary-button" disabled={busy || !selected.length}>Assign {selected.length || ''} {selected.length === 1 ? 'quiz' : 'quizzes'}</button>
    </form>}
  </section>;
}

const freshQuestion = (): Question => ({id: crypto.randomUUID(), prompt: '', kind: 'MCQ', choices: ['', ''], correctOptions: [0]});
export function AdminAssessments() {
  const [data,setData]=useState<AssessmentData>({quizzes:[],assignments:[],bank:[]}); const [courses,setCourses]=useState<{id:string;title:string}[]>([]);
  const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [busy,setBusy]=useState(false);
  const [question,setQuestion]=useState<Question>(freshQuestion); const [questions,setQuestions]=useState<Question[]>([]);
  const [submissions,setSubmissions]=useState<Submission[]>([]); const [assignment,setAssignment]=useState<Assignment|null>(null);
  async function load(){setData((await api<ApiOne<AssessmentData>>('/assessments/admin')).data)}
  useEffect(()=>{void load().catch(e=>setError(messageFromError(e)));api<ApiList<{id:string;title:string}>>('/academy/admin/courses?pageSize=100').then(r=>setCourses(r.data)).catch(e=>setError(messageFromError(e)));},[]);
  async function run(fn:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await fn();await load()}catch(e){setError(messageFromError(e))}finally{setBusy(false)}}
  async function createQuiz(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);await run(async()=>{await api('/assessments/admin/quizzes',{method:'POST',body:JSON.stringify({courseId:f.get('courseId'),title:f.get('title'),durationMinutes:Number(f.get('duration')),maxAttempts:Number(f.get('attempts')),passPercent:Number(f.get('pass')),published:false,assignmentOnly:f.has('assignmentOnly'),questions})});setQuestions([]);form.reset();setNotice('Quiz saved as a draft. Publish when ready.')})}
  async function createAssignment(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);await run(async()=>{await api('/assessments/admin/assignments',{method:'POST',body:JSON.stringify({courseId:f.get('courseId'),title:f.get('title'),instructions:f.get('instructions'),maxScore:Number(f.get('maxScore')),dueAt:f.get('dueAt')?new Date(String(f.get('dueAt'))).toISOString():null,published:false})});form.reset();setNotice('Assignment saved as a draft.')})}
  async function showSubmissions(a:Assignment){setAssignment(a);setSubmissions((await api<ApiOne<Submission[]>>(`/assessments/admin/assignments/${a.id}/submissions`)).data)}
  return <div className="assessment-page"><PageTitle kicker="ASSESSMENTS" title="Quizzes & assignments" description="Build question banks, publish timed quizzes, and review assignment submissions."/>{error&&<Alert message={error}/>} {notice&&<Alert success message={notice}/>}
    <AssignQuizzes/>
    <section className="academy-panel"><h2>Question editor</h2><div className="auth-form"><label>Question type<select value={question.kind} onChange={e=>setQuestion({...question,kind:e.target.value as Question['kind'],choices:e.target.value==='TRUE_FALSE'?['True','False']:['',''],correctOptions:[0]})}><option value="MCQ">Single answer</option><option value="MULTI">Multiple answers</option><option value="TRUE_FALSE">True / false</option></select></label><label>Question<textarea value={question.prompt} maxLength={2000} onChange={e=>setQuestion({...question,prompt:e.target.value})}/></label>
      {question.choices.map((choice,index)=><div className="assessment-editor-choice" key={index}><label>Choice {index+1}<input disabled={question.kind==='TRUE_FALSE'} value={choice} maxLength={500} onChange={e=>setQuestion({...question,choices:question.choices.map((v,i)=>i===index?e.target.value:v)})}/></label><label className="assessment-choice"><input type={question.kind==='MULTI'?'checkbox':'radio'} name="correct-answer" checked={question.correctOptions.includes(index)} onChange={e=>setQuestion({...question,correctOptions:question.kind==='MULTI'?(e.target.checked?[...question.correctOptions,index]:question.correctOptions.filter(i=>i!==index)):[index]})}/> <span>Correct answer</span></label></div>)}
      <div className="academy-actions">{question.kind!=='TRUE_FALSE'&&<button disabled={question.choices.length>=8} onClick={()=>setQuestion({...question,choices:[...question.choices,'']})}>Add choice</button>}<button disabled={busy||question.prompt.trim().length<3||question.choices.some(c=>!c.trim())||!question.correctOptions.length} onClick={()=>{setQuestions(v=>[...v,question]);setQuestion(freshQuestion())}}>Add question to quiz</button><button disabled={busy} onClick={()=>void run(async()=>{await api('/assessments/admin/questions',{method:'POST',body:JSON.stringify(question)});setNotice('Question saved to the bank.')})}>Save to question bank</button></div>
    </div><details><summary>Question bank ({data.bank?.length||0})</summary>{data.bank?.map(b=><p key={b.id}>{b.question.prompt} <button disabled={questions.some(q=>q.id===b.question.id)} onClick={()=>setQuestions(v=>[...v,b.question])}>Use in quiz</button></p>)}</details></section>
    <section className="academy-panel"><h2>Create quiz</h2><ol>{questions.map(q=><li key={q.id}>{q.prompt} <button onClick={()=>setQuestions(v=>v.filter(i=>i.id!==q.id))}>Remove from draft</button></li>)}</ol><form className="academy-form-grid" onSubmit={createQuiz}><label>Course<select name="courseId" required><option value="">Choose course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Quiz title<input name="title" required minLength={3} maxLength={180}/></label><label>Time limit (minutes)<input name="duration" type="number" min={1} max={180} defaultValue={30}/></label><label>Maximum attempts<input name="attempts" type="number" min={1} max={20} defaultValue={3}/></label><label>Passing score (%)<input name="pass" type="number" min={1} max={100} defaultValue={70}/></label><label className="assessment-choice academy-wide"><input type="checkbox" name="assignmentOnly"/>Only students assigned this quiz can take it</label><button className="primary-button" disabled={busy||!questions.length}>Save draft quiz</button></form></section>
    <section className="academy-panel"><h2>Quizzes</h2>{data.quizzes.map(q=><div className="assessment-row assessment-record" key={q.id}><span>{q.title} · {q.course.title} · {q.questions.length} questions · {q.published?'Published':'Draft'} · {q.assignmentOnly?'Assigned students only':'All active course students'}</span><button disabled={busy} onClick={()=>void run(async()=>{await api(`/assessments/admin/quizzes/${q.id}`,{method:'PATCH',body:JSON.stringify({title:q.title,durationMinutes:q.durationMinutes,maxAttempts:q.maxAttempts,passPercent:q.passPercent,questions:q.questions,published:!q.published})})})}>{q.published?'Unpublish':'Publish'}</button></div>)}</section>
    <section className="academy-panel"><h2>Create assignment</h2><form className="academy-form-grid" onSubmit={createAssignment}><label>Course<select name="courseId" required><option value="">Choose course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Title<input name="title" required minLength={3} maxLength={180}/></label><label className="academy-wide">Instructions<textarea name="instructions" required minLength={3} maxLength={20000}/></label><label>Maximum score<input name="maxScore" type="number" min={1} max={1000} defaultValue={100}/></label><label>Deadline (optional, local time)<input name="dueAt" type="datetime-local"/></label><button className="primary-button" disabled={busy}>Save draft assignment</button></form></section>
    <section className="academy-panel"><h2>Assignments</h2>{data.assignments.map(a=><div className="assessment-row assessment-record" key={a.id}><span>{a.title} · {a.course.title} · {a.published?'Published':'Draft'}</span><button disabled={busy} onClick={()=>void run(async()=>{await api(`/assessments/admin/assignments/${a.id}`,{method:'PATCH',body:JSON.stringify({title:a.title,instructions:a.instructions,dueAt:a.dueAt,maxScore:a.maxScore,published:!a.published})})})}>{a.published?'Unpublish':'Publish'}</button><button disabled={busy} onClick={()=>void run(()=>showSubmissions(a))}>Review submissions</button></div>)}</section>
    {assignment&&<section className="academy-panel"><h2>Submissions: {assignment.title}</h2>{!submissions.length&&<p>No submissions yet.</p>}{submissions.map(s=><article key={s.id} className="academy-module"><h3>{s.user?.name}</h3><p>{s.user?.email} · {new Date(s.submittedAt).toLocaleString()}</p><p style={{whiteSpace:'pre-wrap'}}>{s.text}</p>{s.fileId&&<a href={`${API_URL}/assessments/submissions/${s.id}/file`}>Download submitted PDF</a>}{s.reviews.map(r=><p key={r.id}>{r.score}/{assignment.maxScore} · {r.feedback} · {new Date(r.createdAt).toLocaleString()}</p>)}<form className="auth-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(async()=>{await api(`/assessments/admin/submissions/${s.id}/reviews`,{method:'POST',body:JSON.stringify({score:Number(f.get('score')),feedback:f.get('feedback')})});await showSubmissions(assignment)})}}><label>Score (maximum {assignment.maxScore})<input name="score" type="number" required min={0} max={assignment.maxScore}/></label><label>Feedback<textarea name="feedback" required maxLength={10000}/></label><button disabled={busy} className="primary-button">Save evaluation</button></form></article>)}</section>}
  </div>;
}

const focusQuizHeading = (element: HTMLHeadingElement | null) => element?.focus();

type ActiveAttempt = {id:string;expiresAt:string;answers:{questionId:string;selected:number[]}[];questions:Omit<Question,'correctOptions'>[]};
export function StudentAssessments() {
  const [data,setData]=useState<AssessmentData>({quizzes:[],assignments:[]}); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [busy,setBusy]=useState(false);
  const [attempt,setAttempt]=useState<(ActiveAttempt & {title: string})|null>(null);
  const [tab, setTab] = useState<'quizzes' | 'assignments'>('quizzes');
  const [loading, setLoading] = useState(true);
   const [answers,setAnswers]=useState<Record<string,number[]>>({}); const [now,setNow]=useState(Date.now());
  async function load(){setData((await api<ApiOne<AssessmentData>>('/assessments/student')).data)}
  useEffect(()=>{void load().catch(e=>setError(messageFromError(e))).finally(()=>setLoading(false));},[]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[]);
  useEffect(() => {
    if (!attempt || busy || new Date(attempt.expiresAt).getTime() <= Date.now()) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void api(`/assessments/student/attempts/${attempt.id}/answers`, {
        method: 'PUT',
        body: JSON.stringify({ answers: Object.entries(answers).map(([questionId, selected]) => ({ questionId, selected })) }),
      }).catch(() => { if (!cancelled) setError('Could not save quiz progress. Keep this page open and submit your answers.'); });
    }, 600);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [attempt, answers, busy]);
  async function run(fn:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await fn();await load()}catch(e){setError(messageFromError(e))}finally{setBusy(false)}}
  async function submitQuiz(e:FormEvent){e.preventDefault();if(!attempt)return;await run(async()=>{const result=await api<ApiOne<{status:string;score:number;passed:boolean}>>(`/assessments/student/attempts/${attempt.id}/submit`,{method:'POST',body:JSON.stringify({answers:Object.entries(answers).map(([questionId,selected])=>({questionId,selected}))})});setNotice(result.data.status==='EXPIRED'?'Time expired. This attempt was not accepted.':`Score: ${result.data.score}% · ${result.data.passed?'Passed':'Not passed'}`);setAttempt(null);setAnswers({})})}
  async function submitAssignment(e:FormEvent<HTMLFormElement>,assignmentId:string){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);await run(async()=>{let fileId:string|undefined;const file=f.get('file');if(file instanceof File&&file.size){if(file.size>10*1024*1024)throw new Error('PDF submissions must be 10 MB or smaller.');fileId=(await api<ApiOne<{fileId:string}>>(`/assessments/student/assignments/${assignmentId}/files`,{method:'POST',headers:{'Content-Type':'application/pdf'},body:file})).data.fileId}await api(`/assessments/student/assignments/${assignmentId}/submissions`,{method:'POST',body:JSON.stringify({text:String(f.get('text')||''),...(fileId?{fileId}:{})})});form.reset();setNotice('Assignment submitted for review.')})}
  async function openQuiz(quiz: Quiz) {
    await run(async () => {
      const result = await api<ApiOne<ActiveAttempt>>(`/assessments/student/quizzes/${quiz.id}/start`, { method: 'POST' });
      setAttempt({ ...result.data, title: quiz.title });
      setAnswers(Object.fromEntries(result.data.answers.map(answer => [answer.questionId, answer.selected])));
      setNow(Date.now());
    });
  }

  const assignedFirst = [...data.quizzes].sort((a, b) => Number(!!b.studentAssignments?.length) - Number(!!a.studentAssignments?.length));
  const secondsLeft = attempt ? Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - now) / 1000)) : 0;
  const answered = Object.values(answers).filter(selected => selected.length).length;

  return <div className="assessment-page">
    <PageTitle kicker="ASSESSMENTS" title={attempt?.title ?? 'Quizzes & assignments'}
      description={attempt ? 'Answer the questions, then submit before time runs out.' : 'Choose a quiz to take or open Assignments to submit your work.'}/>
    <div role="status">{notice && <Alert success message={notice}/>}</div>
    {error && <div role="alert"><Alert message={error}/></div>}
    {loading && <p role="status">Loading assessments…</p>}
    {!loading && !attempt && <nav className="assessment-nav" aria-label="Assessment type">
      <button className={tab === 'quizzes' ? 'primary-button' : 'academy-small-button'} aria-pressed={tab === 'quizzes'} disabled={busy} onClick={() => setTab('quizzes')}>Quizzes</button>
      <button className={tab === 'assignments' ? 'primary-button' : 'academy-small-button'} aria-pressed={tab === 'assignments'} disabled={busy} onClick={() => setTab('assignments')}>Assignments</button>
    </nav>}
    {attempt && <section className="academy-panel">
      <h2 tabIndex={-1} ref={focusQuizHeading}>Quiz in progress</h2>
      <div className="assessment-row assessment-timer">
        <strong>{secondsLeft ? `Time left ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : 'Time expired'}</strong>
        <span>{answered} of {attempt.questions.length} answered</span>
      </div>
      <form className="auth-form" onSubmit={submitQuiz}>
        {attempt.questions.map((question, index) => <fieldset key={question.id} disabled={busy || !secondsLeft}>
          <legend>{index + 1}. {question.prompt}</legend>
          <p>{question.kind === 'MULTI' ? 'Select all that apply.' : 'Select one answer.'}</p>
          {question.choices.map((choice, choiceIndex) => <label key={choiceIndex} className="assessment-choice">
            <input type={question.kind === 'MULTI' ? 'checkbox' : 'radio'} name={question.id}
              checked={(answers[question.id] || []).includes(choiceIndex)}
              onChange={event => setAnswers(current => {
                const selected = current[question.id] || [];
                return { ...current, [question.id]: question.kind === 'MULTI'
                  ? (event.target.checked ? [...selected, choiceIndex] : selected.filter(value => value !== choiceIndex))
                  : [choiceIndex] };
              })}/>
            <span>{choice}</span>
          </label>)}
        </fieldset>)}
        <button className="primary-button" disabled={busy}>{secondsLeft ? 'Submit quiz' : 'Finish expired attempt'}</button>
      </form>
    </section>}
    {!loading && !attempt && tab === 'quizzes' && <section className="academy-panel">
      <h2>Available quizzes</h2>
      <p>Assigned quizzes appear first. The timer starts when you select Start quiz.</p>
      {!assignedFirst.length && <p>No quizzes are available yet for your active courses.</p>}
      <div className="assessment-grid">{assignedFirst.map(quiz => {
        const attempts = quiz.attempts ?? [];
        const active = attempts.some(item => item.status === 'IN_PROGRESS' && Date.parse(item.expiresAt) > now);
        const remaining = Math.max(0, quiz.maxAttempts - attempts.length);
        return <article className="academy-module assessment-card" key={quiz.id}>
          <h3>{quiz.title}</h3>
          <p>{quiz.course.title}{!!quiz.studentAssignments?.length && ' · Assigned to you'}</p>
          <p>{quiz.durationMinutes} min · {quiz.passPercent}% to pass · {remaining} new {remaining === 1 ? 'attempt' : 'attempts'} left</p>
          {!!attempts.length && <details><summary>Attempt history</summary>{attempts.map(item => <p key={item.id}>
            Attempt {item.number} · {item.status === 'IN_PROGRESS' ? (Date.parse(item.expiresAt) > now ? 'In progress' : 'Expired')
              : item.status === 'EXPIRED' ? 'Expired' : item.passed ? 'Passed' : 'Submitted'}
            {item.score !== null && ` · ${item.score}%`}
          </p>)}</details>}
          <button className="primary-button" disabled={busy || !active && !remaining} onClick={() => void openQuiz(quiz)}>
            {active ? 'Resume quiz' : !remaining ? 'No attempts left' : attempts.length ? 'Start new attempt' : 'Start quiz'}
          </button>
        </article>;
      })}</div>
    </section>}
    {!loading && !attempt && tab === 'assignments' && <section className="academy-panel"><h2>Assignments</h2>{!data.assignments.length&&<p>No assignments available for your active courses.</p>}{data.assignments.map(a=><article className="academy-module assessment-assignment" key={a.id}><h3>{a.title}</h3><p>{a.course.title} · Maximum score: {a.maxScore} · Deadline: {a.dueAt?new Date(a.dueAt).toLocaleString():'No deadline'}</p><p style={{whiteSpace:'pre-wrap'}}>{a.instructions}</p><form className="auth-form" onSubmit={e=>void submitAssignment(e,a.id)}><label>Your response<textarea name="text" maxLength={20000}/></label><label>PDF file (optional, up to 10 MB)<input type="file" name="file" accept="application/pdf"/></label><button disabled={busy||!!a.dueAt&&new Date(a.dueAt)<=new Date()} className="primary-button">Submit assignment</button></form>{a.submissions?.map(s=><details key={s.id}><summary>Submission from {new Date(s.submittedAt).toLocaleString()}</summary><p>{s.text}</p>{s.fileId&&<a href={`${API_URL}/assessments/submissions/${s.id}/file`}>Your submitted PDF</a>}{s.reviews.length?s.reviews.map(r=><p key={r.id}>{r.score}/{a.maxScore} · {r.feedback}</p>):<p>Awaiting evaluation</p>}</details>)}</article>)}</section>}
  </div>;
}
