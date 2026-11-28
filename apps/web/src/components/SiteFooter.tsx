import { Link } from 'react-router-dom';
import { Brand } from './UI';

export function SiteFooter() {
  return <footer className="academy-footer">
    <div className="academy-container academy-footer-inner">
      <Link className="academy-footer-brand" to="/"><Brand/></Link>
      <nav aria-label="Footer navigation">
        <Link to="/about">About</Link>
        <Link to="/faq">FAQ</Link>
        <Link to="/contact">Contact</Link>
      </nav>
      <a className="academy-footer-copyright" href="https://aspireedgegroup.com">© {new Date().getFullYear()} Aspireedge Pvt. Ltd.</a>
    </div>
  </footer>;
}
