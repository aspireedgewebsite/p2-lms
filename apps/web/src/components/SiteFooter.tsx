import { ArrowRight, ArrowUp, Mail } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { courseTracks } from '../lib/courseTracks';
import { groupLinks } from '../lib/groupLinks';
import { Brand } from './UI';

const footerGroups = [
  {
    heading: 'Learning programs',
    links: [
      ...courseTracks.map(track => ({ label: track.title, to: '/courses?track=' + track.id })),
      { label: 'All courses', to: '/courses' },
    ],
  },
  {
    heading: 'Company',
    links: [{ label: 'About Aspireedge', to: '/about' }, { label: 'Contact us', to: '/contact' }],
  },
  {
    heading: 'Student support',
    links: [
      { label: 'Student sign in', to: '/login' },
      { label: 'Student registration', to: '/register' },
      { label: 'Frequently asked questions', to: '/faq' },
      { label: 'Payment support', to: '/contact' },
      { label: 'Verify a certificate', to: '/verify-certificate' },
    ],
  },
];

export function SiteFooter() {
  const pathname = useLocation().pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (/^\/(?:admin|student|login|register|forgot-password|reset-password|verify-email)(?:\/|$)/.test(pathname)) return null;

  const showCallToAction = ['/', '/about', '/courses'].includes(pathname);

  function backToTop() {
    document.getElementById('site-home-link')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  return <footer className="academy-footer">
    {showCallToAction && <section className="footer-cta" aria-labelledby="footer-cta-title">
      <div className="academy-container footer-cta-inner">
        <div>
          <h2 id="footer-cta-title">Take the next step in your career.</h2>
          <p>Build practical skills with courses you can take at your own pace.</p>
        </div>
        <Link className="footer-cta-button" to="/courses" viewTransition>Explore courses <ArrowRight size={18} aria-hidden="true"/></Link>
      </div>
    </section>}
    <div className="academy-container">
      <div className="footer-grid" data-reveal>
        <div className="footer-company">
          <Link to="/" aria-label="Aspireedge home"><Brand/></Link>
          <p>A unit of Aspireedge Pvt. Ltd.</p>
          <p>Practical skills through online courses and professional training.</p>
          <a href={'mailto:' + groupLinks.email}><Mail size={16} aria-hidden="true"/>{groupLinks.email}</a>
          <a href={groupLinks.home}>Aspireedge Group</a>
        </div>
        {footerGroups.map(({ heading, links }) => <nav key={heading} aria-label={heading}>
          <h2>{heading}</h2>
          <ul>{links.map(({ label, to }) => <li key={label}><Link to={to} viewTransition>{label}</Link></li>)}</ul>
        </nav>)}
      </div>
      <div className="footer-bottom">
        <small>© {new Date().getFullYear()} Aspireedge Pvt. Ltd. All rights reserved.</small>
        <button type="button" onClick={backToTop}>Back to top <ArrowUp size={16} aria-hidden="true"/></button>
      </div>
    </div>
  </footer>;
}
