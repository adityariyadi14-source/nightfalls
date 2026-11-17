import { useSyncExternalStore } from 'react';
import { randomId } from '../../engine';

export interface Prefs {
  name: string;
  avatar: number;
  theme: string;
  sfx: boolean;
  music: boolean;
  volume: number; // 0..1
  reducedMotion: boolean;
  lang: 'en' | 'id';
  /** pixel or smooth render of the profile photo, shown in-game */
  photo?: string;
  /** square source copy kept so the pixel option can be toggled */
  photoSrc?: string;
  photoPixel: boolean;
  /** when this device's resident card was issued */
  issuedAt?: number;
  guestId: string | null;
  secret: string | null;
  localId: string;
}

const KEY = 'nightfall.prefs.v1';
const THEME_IDS = ['blood', 'mainframe', 'amber', 'cold', 'bone'];
const NAMES = ['Raven', 'Ash', 'Juniper', 'Sable', 'Wren', 'Orion', 'Vesper', 'Lark', 'Echo', 'Nyx'];

function load(): Prefs {
  const base: Prefs = {
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    avatar: Math.floor(Math.random() * 24),
    theme: 'blood',
    sfx: true,
    music: true,
    volume: 0.6,
    reducedMotion: false,
    photoPixel: true,
    lang: typeof navigator !== 'undefined' && /^id\b|^in\b/i.test(navigator.language || '') ? 'id' : 'en',
    guestId: null,
    secret: null,
    localId: randomId(12)
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = { ...base, ...JSON.parse(raw) } as Prefs;
      if (!THEME_IDS.includes(saved.theme)) saved.theme = base.theme; // themes from the old look
      return saved;
    }
  } catch { /* ignore */ }
  return base;
}

let prefs = load();
const listeners = new Set<() => void>();

export function getPrefs() {
  return prefs;
}
export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
export function usePrefs() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => prefs
  );
}
