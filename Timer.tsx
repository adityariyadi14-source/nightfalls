import { useEffect, useState } from 'react';
import { sfx } from '../lib/audio';
import { t } from '../lib/i18n';
import { Icon } from './Icon';

export function useNow(interval = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

export function Timer({ endsAt, startedAt, offset = 0, label, warnAt = 10, compact }: { endsAt: number | null; startedAt: number; offset?: number; label?: string; warnAt?: number; compact?: boolean }) {
  const now = useNow();
  const remainingMs = endsAt ? Math.max(0, endsAt - (now + offset)) : 0;
  const total = endsAt ? Math.max(1, endsAt - startedAt) : 1;
  const secs = Math.ceil(remainingMs / 1000);
  const pct = endsAt ? Math.max(0, Math.min(100, (remainingMs / total) * 100)) : 100;
  const warn = endsAt !== null && secs <= warnAt && secs > 0;
  useEffect(() => {
    if (warn) sfx.tick();
  }, [secs, warn]);
  if (!endsAt) return null;
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  if (compact) {
    return (
      <span className={`chip tabular-nums ${warn ? '!border-danger !text-danger' : ''}`}><Icon name="clock" size={11} /> {mm}:{ss}</span>
    );
  }
  return (
    <div className="w-full">
      <div className="mb-1 flex items-baseline justify-between">
        {label && <span className="label">{t(label)}</span>}
        <span className={`font-mono text-2xl font-bold tabular-nums ${warn ? 'text-danger animate-pulse' : ''}`}>
          {mm}:{ss}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden bg-line/60">
        <div className={`h-full transition-[width] duration-300 ${warn ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
