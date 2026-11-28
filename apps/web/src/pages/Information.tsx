import { Link } from 'react-router-dom';
import { groupLinks } from '../lib/groupLinks';
import { PublicHeader } from './Public';

const questions = [
  ['How do I start learning?', 'Create a student account, browse the course catalog, and enroll in a free course or request access to a paid course.'],
  ['Where is my Student ID?', 'After signing in, your Student ID appears in your learning dashboard and in Profile & security. Share it with the administrator when requesting manual course access.'],
  ['Can I pay online?', 'Online checkout is not available yet. Request verified payment instructions from the administrator before making an offline payment. Course access begins after the administrator confirms it.'],
  ['Can I continue where I left off?', 'Completed lessons are saved to your account. The course player opens your first incomplete lesson when you return.'],
  ['What happens when access is revoked?', 'You can no longer open premium course content. Your saved learning progress remains recorded and is available if access is restored.'],
  ['How do I recover my account?', 'Choose Forgot password on the sign-in page. In this local development version, account emails are delivered to the private local mailbox rather than sent externally.'],
];
export function Information({ page }: { page: 'faq' | 'about' | 'contact' }) {
  const title = { faq: 'Frequently asked questions', about: 'About Aspireedge', contact: 'Contact Aspireedge' }[page];

  return <><PublicHeader/><main className="academy-container academy-section public-content">
    <span className="eyebrow">A unit of Aspireedge Pvt. Ltd.</span>
    <h1>{title}</h1>
    {page === 'faq' && questions.map(([question, answer]) => <details className="academy-panel" key={question}>
      <summary><strong>{question}</strong></summary><p>{answer}</p>
    </details>)}
    {page === 'about' && <section className="academy-panel">
      <h2>Courses and career development</h2>
      <p>Aspireedge helps learners build practical skills through online courses and professional training. Browse the curriculum, preview available lessons, and track your progress from your student dashboard.</p>
      <div className="academy-actions">
        <Link className="primary-button inline-button" to="/courses">Explore courses</Link>
        <a className="academy-outline-button" href={groupLinks.home}>Visit Aspireedge Group</a>
      </div>
    </section>}
    {page === 'contact' && <section className="academy-panel">
      <h2>Course and account support</h2>
      <p>For help with course access, include your Student ID and course title. Keep passwords and reset links private.</p>
      <div className="academy-actions">
        <a className="primary-button inline-button" href={`mailto:${groupLinks.email}`}>Email Aspireedge</a>
        <a className="academy-outline-button" href={groupLinks.home}>Visit Aspireedge Group</a>
        <Link className="academy-outline-button" to="/faq">Read the FAQ</Link>
      </div>
      <p>{groupLinks.email}</p>
    </section>}
  </main></>;
}
