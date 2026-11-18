import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '../components/Icon';
import { sfx } from '../lib/audio';
import { t } from '../lib/i18n';

/**
 * Busywork for players with nothing to do at night. On a shared device everyone should spend a
 * similar time tapping, so nobody can tell who has a real ability. The tasks change nothing.
 */
type TaskKind = 'locks' | 'keypad' | 'fog' | 'files';
const KINDS: TaskKind[] = ['locks', 'keypad', 'fog', 'files'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed || 1;
  return () => ((a = Math.imul(a ^ (a >>> 15), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909)), (a >>> 0) / 4294967296);
}

const TITLES: Record<TaskKind, { title: string; hint: string }> = {
  locks: { title: 'Lock every door', hint: 'Tap each door until all are locked.' },
  keypad: { title: 'Enter the safe code', hint: 'Type the code shown above the keypad.' },
  fog: { title: 'Wipe the window', hint: 'Clear the fog from every pane.' },
  files: { title: 'Sort the case files', hint: 'Tap the files in order, from 1 upward.' }
};

export function NightTask({ seed, onDone }: { seed: string; onDone: () => void }) {
  const r = useMemo(() => rng(hash(seed)), [seed]);
  const kind = useMemo(() => KINDS[Math.floor(r() * KINDS.length)], [r]);
  const [done, setDone] = useState(false);
  const finish = () => {
    if (done) return;
    setDone(true);
    sfx.notify();
    onDone();
  };
  const meta = TITLES[kind];
  return (
    <div className="border border-line/70 bg-ink/40 p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-fg">{t(meta.title)}</span>
        {done && <span className="chip !border-accent2/60 !text-accent2"><Icon name="check" size={11} /> {t('done')}</span>}
      </div>
      <p className="mb-3 text-[11px] text-muted">{t(meta.hint)}</p>
      {kind === 'locks' && <Locks r={r} onDone={finish} />}
      {kind === 'keypad' && <Keypad r={r} onDone={finish} />}
      {kind === 'fog' && <Fog onDone={finish} />}
      {kind === 'files' && <Files r={r} onDone={finish} />}
    </div>
  );
}

function Locks({ r, onDone }: { r: () => number; onDone: () => void }) {
  const [locked, setLocked] = useState<boolean[]>(() => Array.from({ length: 6 }, () => r() < 0.2));
  const tap = (i: number) => {
    const next = locked.map((v, j) => (j === i ? !v : v));
    sfx.click();
    setLocked(next);
    if (next.every(Boolean)) onDone();
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      {locked.map((v, i) => (
        <motion.button key={i} type="button" whileTap={{ scale: 0.92 }} onClick={() => tap(i)} className={`flex h-16 flex-col items-center justify-center gap-1 border text-[10px] font-bold uppercase tracking-wider ${v ? 'border-accent2 text-accent2' : 'border-line text-muted'}`}>
          <Icon name={v ? 'lock' : 'door'} size={20} />
          {v ? t('locked') : t('open')}
        </motion.button>
      ))}
    </div>
  );
}

function Keypad({ r, onDone }: { r: () => number; onDone: () => void }) {
  const code = useMemo(() => Array.from({ length: 4 }, () => Math.floor(r() * 10)).join(''), [r]);
  const [entry, setEntry] = useState('');
  const press = (d: string) => {
    sfx.click();
    const next = (entry + d).slice(-4);
    setEntry(next);
    if (next === code) onDone();
    else if (next.length === 4 && next !== code) setTimeout(() => setEntry(''), 250);
  };
  return (
    <div className="mx-auto max-w-[15rem]">
      <div className="mb-2 flex items-center justify-between border border-line bg-ink px-3 py-2 font-mono text-lg tracking-[0.4em]">
        <span className="text-muted">{code}</span>
        <span className="text-accent">{entry.padEnd(4, '·')}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''].map((d, i) =>
          d ? (
            <motion.button key={i} type="button" whileTap={{ scale: 0.9 }} onClick={() => press(d)} className="h-11 border border-line font-mono text-lg hover:border-accent">
              {d}
            </motion.button>
          ) : (
            <span key={i} />
          )
        )}
      </div>
    </div>
  );
}

function Fog({ onDone }: { onDone: () => void }) {
  const [clear, setClear] = useState<boolean[]>(() => Array(9).fill(false));
  const wipe = (i: number) => {
    if (clear[i]) return;
    sfx.hover();
    const next = clear.map((v, j) => (j === i ? true : v));
    setClear(next);
    if (next.every(Boolean)) onDone();
  };
  return (
    <div className="grid grid-cols-3 gap-1" onPointerLeave={() => undefined}>
      {clear.map((v, i) => (
        <button
          key={i}
          type="button"
          onPointerEnter={(e) => e.buttons && wipe(i)}
          onPointerDown={() => wipe(i)}
          className="h-14 border border-line/60 transition-colors duration-300"
          style={{ background: v ? 'rgb(var(--c-bg))' : 'linear-gradient(135deg, rgb(160 160 170 / 0.35), rgb(120 120 130 / 0.2))' }}
          aria-label={v ? t('clear') : t('foggy')}
        />
      ))}
    </div>
  );
}

function Files({ r, onDone }: { r: () => number; onDone: () => void }) {
  const order = useMemo(() => {
    const a = [1, 2, 3, 4, 5, 6];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [r]);
  const [next, setNext] = useState(1);
  const tap = (n: number) => {
    if (n !== next) {
      sfx.error();
      setNext(1);
      return;
    }
    sfx.click();
    if (n === 6) onDone();
    setNext(n + 1);
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      {order.map((n) => (
        <motion.button key={n} type="button" whileTap={{ scale: 0.92 }} onClick={() => tap(n)} className={`h-14 border font-mono text-xl ${n < next ? 'border-accent2 text-accent2' : 'border-line text-fg'}`}>
          {n < next ? '✓' : String(n).padStart(2, '0')}
        </motion.button>
      ))}
    </div>
  );
}
