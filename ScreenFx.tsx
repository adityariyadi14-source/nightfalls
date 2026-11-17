import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BloodSplatter } from './Avatar';
import { Timer } from './Timer';
import { sfx } from '../lib/audio';
import { t } from '../lib/i18n';

/**
 * Online night: when a player has nothing left to do, their eyes close. Eyelids blink shut,
 * the screen goes dark with a slow heartbeat line and the occasional glitch.
 */
export function SleepOverlay({ open, onWake, canWake, endsAt, startedAt, offset }: { open: boolean; onWake: () => void; canWake: boolean; endsAt: number | null; startedAt: number; offset: number }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[35] overflow-hidden" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }} aria-live="polite">
          {/* eyelids: close halfway, blink open, then shut */}
          <motion.div className="absolute inset-x-0 top-0 bg-black" style={{ borderBottom: '2px solid rgb(var(--c-accent) / 0.4)' }} initial={{ height: '0%' }} animate={{ height: ['0%', '38%', '12%', '51%'] }} transition={{ duration: 1.6, times: [0, 0.35, 0.55, 1], ease: 'easeInOut' }} />
          <motion.div className="absolute inset-x-0 bottom-0 bg-black" style={{ borderTop: '2px solid rgb(var(--c-accent) / 0.4)' }} initial={{ height: '0%' }} animate={{ height: ['0%', '38%', '12%', '51%'] }} transition={{ duration: 1.6, times: [0, 0.35, 0.55, 1], ease: 'easeInOut' }} />
          <motion.div className="absolute inset-0 flex flex-col items-center justify-center bg-black px-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 0.8 }}>
            <div className="sleep-glitch relative">
              {['Z', 'z', 'z'].map((z, i) => (
                <motion.span key={i} className="title absolute text-accent/70" style={{ left: i * 22, fontSize: 34 - i * 8 }} animate={{ y: [0, -40], opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 3, delay: i * 0.8 }}>
                  {z}
                </motion.span>
              ))}
            </div>
            <h2 className="title mt-16 text-4xl text-fg/80">{t('You are asleep')}</h2>
            <p className="mt-2 max-w-xs text-[12px] text-muted">{t('The night goes on without you. Something moves in the dark.')}</p>
            <svg viewBox="0 0 200 40" className="mt-6 w-56 text-accent/70" aria-hidden>
              <motion.path d="M0 20 H70 L78 6 L86 34 L94 20 H200" fill="none" stroke="currentColor" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }} />
            </svg>
            <div className="mt-6 w-56"><Timer endsAt={endsAt} startedAt={startedAt} offset={offset} label="Dawn in" /></div>
            {canWake && (
              <button type="button" onClick={() => { sfx.click(); onWake(); }} className="mt-8 border border-line px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted hover:border-accent hover:text-accent">
                {t('Wake up')}
              </button>
            )}
          </motion.div>
          <div className="sleep-tear pointer-events-none absolute inset-0" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Full-screen death sequence: signal loss, glitch slices, blood. Plays once, then fades. */
export function DeathOverlay({ open, cause, onDone }: { open: boolean; cause: string; onDone: () => void }) {
  useEffect(() => {
    if (!open) return;
    sfx.death();
    setTimeout(() => sfx.glitch(), 250);
    setTimeout(() => sfx.glitch(), 900);
    const tm = setTimeout(onDone, 4800);
    return () => clearTimeout(tm);
  }, [open]);
  const splats = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: (i * 37 + 11) % 90, y: (i * 53 + 7) % 85, s: 90 + ((i * 41) % 140), d: 0.15 + i * 0.12 })), []);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="death-shake fixed inset-0 z-[66] overflow-hidden bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 1 } }} role="alert">
          <motion.div className="absolute inset-0" initial={{ opacity: 0.9 }} animate={{ opacity: [0.9, 0.2, 0.6, 0.15] }} transition={{ duration: 1.2 }} style={{ background: 'radial-gradient(circle, rgb(170 0 20 / 0.5), rgb(40 0 4) 70%)' }} />
          {splats.map((p, i) => (
            <motion.div key={i} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s }} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.95 }} transition={{ delay: p.d, duration: 0.18, ease: 'easeOut' }}>
              <BloodSplatter seed={i * 13 + 5} />
            </motion.div>
          ))}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className="death-title relative">
              <h2 className="title text-[clamp(3.5rem,16vw,9rem)] leading-none text-danger" data-text={t('You are dead')}>{t('You are dead')}</h2>
            </div>
            <motion.p className="mt-4 max-w-md text-[13px] uppercase tracking-[0.2em] text-fg/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
              {cause}
            </motion.p>
            <motion.p className="mt-6 font-mono text-[11px] tracking-[0.3em] text-danger" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0, 1] }} transition={{ delay: 1.8, duration: 1 }}>
              ERR_SIGNAL_LOST · 0x0000DEAD
            </motion.p>
          </div>
          <div className="glitch-slices pointer-events-none absolute inset-0" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** While dead (online): bloody corners, drained colour and a periodic signal tear. */
export function GhostLayer({ on }: { on: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const i = setInterval(() => setTick((x) => x + 1), 7000);
    return () => clearInterval(i);
  }, [on]);
  if (!on) return null;
  return (
    <div className="ghost-layer pointer-events-none fixed inset-0 z-[34]" aria-hidden>
      {[{ l: '-4%', t: '-6%' }, { l: '82%', t: '-4%' }, { l: '-6%', t: '78%' }, { l: '84%', t: '80%' }].map((p, i) => (
        <div key={i} className="absolute h-44 w-44 opacity-70" style={{ left: p.l, top: p.t }}><BloodSplatter seed={i * 7 + 3} /></div>
      ))}
      <div key={tick} className="ghost-tear absolute inset-0" />
    </div>
  );
}
