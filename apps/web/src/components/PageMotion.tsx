import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function PageMotion() {
  const { pathname, search, hash, key } = useLocation();

  useEffect(() => {
    if (hash || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        target.classList.add('reveal-entered');
        observer.unobserve(target);
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('[data-reveal]:not(.reveal-entered)').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [pathname, search, hash, key]);

  return null;
}
