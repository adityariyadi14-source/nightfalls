/** The artifact build is a static, server-less page: online rooms are unavailable there. */
export const ARTIFACT_BUILD = import.meta.env.VITE_ARTIFACT === '1';
export const ONLINE_AVAILABLE = !ARTIFACT_BUILD;

/** Storage that never throws (private windows and sandboxed frames can block it). */
export const safeStorage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  remove(key: string) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
  clear() {
    try { localStorage.clear(); } catch { /* ignore */ }
  }
};
