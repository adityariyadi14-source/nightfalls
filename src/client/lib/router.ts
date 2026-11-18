import { useEffect, useState } from 'react';

export type Route =
  | { name: 'landing' }
  | { name: 'menu' }
  | { name: 'create' }
  | { name: 'join'; code?: string }
  | { name: 'room' }
  | { name: 'local-setup' }
  | { name: 'local-play' }
  | { name: 'stats' }
  | { name: 'settings' }
  | { name: 'rules' };

/**
 * Routes live in plain `#name` fragments (letters, digits, hyphens) so links work inside
 * sandboxed hosts that only pass simple fragments. Legacy `#/a/b` paths are still understood.
 */
export function parseHash(h: string): Route {
  const raw = h.replace(/^#\/?/, '').replace(/\//g, '-');
  if (raw.startsWith('join-')) return { name: 'join', code: raw.slice(5).toUpperCase() };
  switch (raw) {
    case '': return { name: 'landing' };
    case 'menu': return { name: 'menu' };
    case 'create': return { name: 'create' };
    case 'join': return { name: 'join' };
    case 'room': return { name: 'room' };
    case 'local': return { name: 'local-setup' };
    case 'local-play': return { name: 'local-play' };
    case 'stats': return { name: 'stats' };
    case 'options':
    case 'settings': return { name: 'settings' };
    case 'rules': return { name: 'rules' };
    default: return { name: 'landing' };
  }
}

/** Accepts app paths like '/local/play' and maps them to plain fragments like '#local-play'. */
export function toFragment(path: string) {
  const name = path.replace(/^\/+/, '').replace(/\//g, '-');
  return name === 'settings' ? 'options' : name;
}

export function navigate(path: string) {
  const frag = toFragment(path);
  if (location.hash.replace(/^#/, '') !== frag) location.hash = frag;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
