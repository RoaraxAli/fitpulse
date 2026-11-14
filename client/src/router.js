import { useEffect, useState } from 'react';

// Convert old hash URLs (for existing bookmarks/payment redirects) to clean paths.
if (typeof window !== 'undefined' && window.location.hash.startsWith('#/')) {
  const basePath = window.location.pathname.replace(/\/$/, '');
  window.history.replaceState(null, '', `${basePath}${window.location.hash.slice(1)}`);
}

// The app is served from /fitness on the VM and from the domain root on Vercel.
export const BASE = (() => {
  if (typeof window === 'undefined') return '';
  const pathname = window.location.pathname || '/';
  return pathname === '/fitness' || pathname.startsWith('/fitness/') ? '/fitness' : '';
})();

function stripBase(pathname) {
  if (BASE && (pathname === BASE || pathname.startsWith(`${BASE}/`))) {
    const rest = pathname.slice(BASE.length);
    return rest || '/';
  }
  return pathname || '/';
}

export function parsePath() {
  const pathname = stripBase(window.location.pathname || '/');
  const search = window.location.search || '';
  const query = new URLSearchParams(search);
  return {
    path: pathname || '/dashboard',
    query,
    hash: pathname + search,
    segments: (pathname || '/dashboard').split('/').filter(Boolean),
  };
}

export function useRoute() {
  const [route, setRoute] = useState(parsePath);
  useEffect(() => {
    const onChange = () => {
      setRoute(parsePath());
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return route;
}

export function navigate(to, { replace = false } = {}) {
  const path = to.startsWith('/') ? to : `/${to}`;
  const target = `${BASE}${path}`;
  if (replace) window.history.replaceState(null, '', target);
  else window.history.pushState(null, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function buildQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function usePageQuery() {
  const route = useRoute();
  return route.query;
}
