import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Phase } from '../../engine';
import { t } from '../lib/i18n';
import { sfx } from '../lib/audio';

const TITLES: Partial<Record<Phase, { title: string; sub: (day: number) => string; tone: 'blood' | 'bone' }>> = {
  night: { title: 'Night falls', sub: (d) => t('night {n} // curfew in effect // close your eyes', { n: String(d).padStart(2, '0') }), tone: 'blood' },
  dayAnnounce: { title: 'Dawn', sub: (d) => t('day {n} // counting the living', { n: String(d).padStart(2, '0') }), tone: 'bone' },
  voting: { title: 'Verdict', sub: () => t('the town will now vote // choose carefully'), tone: 'blood' },
  defense: { title: 'On trial', sub: () => t('the accused may speak // everyone else, listen'), tone: 'blood' },
  judgment: { title: 'Judgment', sub: () => t('guilty or not guilty // the town decides'), tone: 'blood' },
  gameOver: { title: 'Case closed', sub: () => t('all files declassified'), tone: 'bone' }
};

/** Full-screen cut whenever the phase changes: black frame, glitching title, typed status line. */
export function PhaseTransition({ phase, day }: { phase: Phase; day: number }) {
  const [show, setShow] = useState<{ phase: Phase; key: number } | null>(null);
  useEffect(() => {
    const tt0 = TITLES[phase];
    if (!tt0) return;
    setShow({ phase, key: Date.now() });
    if (phase === 'night') sfx.night();
    else if (phase === 'dayAnnounce') sfx.day();
    else if (phase === 'voting' || phase === 'judgment') { sfx.glitch(); sfx.gavel(); }
    else if (phase === 'defense') sfx.whoosh();
    else if (phase === 'gameOver') sfx.glitch();
    const timer = setTimeout(() => setShow(null), 2100);
    return () => clearTimeout(timer);
  }, [phase, day]);
  const tt = show ? TITLES[show.phase] : null;
  return (
    <AnimatePresence>
      {show && tt && (
        <motion.div key={show.key} className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <div className="absolute inset-0 bg-ink/95" />
          <motion.div className="absolute left-0 right-0 h-px bg-accent" initial={{ top: '50%', scaleX: 0 }} animate={{ scaleX: [0, 1, 1], top: ['50%', '50%', '0%'] }} transition={{ duration: 1.2, times: [0, 0.3, 1] }} />
          <div className="relative w-full px-6 text-center">
            <motion.h2
              className={`title glitch text-[clamp(3.5rem,15vw,9rem)] leading-none ${tt.tone === 'blood' ? 'text-accent' : 'text-fg'}`}
              initial={{ opacity: 0, letterSpacing: '0.4em', filter: 'blur(6px)' }}
              animate={{ opacity: [0, 1, 0.6, 1], letterSpacing: '0.04em', filter: 'blur(0px)' }}
              transition={{ duration: 0.6, times: [0, 0.5, 0.65, 1] }}
            >
              {t(tt.title)}
            </motion.h2>
            <motion.p className="mt-4 text-[12px] uppercase tracking-[0.25em] text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
              <span className="text-accent">&gt;</span> {tt.sub(day)}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
