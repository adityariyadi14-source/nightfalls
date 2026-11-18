import { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { ROLES, TEAM_LABEL } from '../../engine';
import type { RoleId } from '../../engine';
import { Icon, RoleIcon } from './Icon';
import { t } from '../lib/i18n';
import { sfx } from '../lib/audio';

export function RoleBadge({ role, size = 'sm' }: { role: RoleId; size?: 'sm' | 'md' }) {
  const r = ROLES[role];
  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 ${size === 'md' ? 'py-1 text-[12px]' : 'py-0.5 text-[10px]'} font-bold uppercase tracking-wider`}
      style={{ borderColor: r.color + '99', color: r.color, background: r.color + '14' }}
    >
      <RoleIcon role={role} size={size === 'md' ? 14 : 11} /> {t(r.name)}
    </span>
  );
}

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Role reveal modelled on a card toss: the sealed file rises from below the screen tilted back,
 * then on tap spins ~2.5 turns on its vertical axis with a wobble, decelerates, and lands face up.
 */
export function RoleCard({ role, onRevealed }: { role: RoleId; onRevealed?: () => void }) {
  const r = ROLES[role];
  const controls = useAnimationControls();
  const [state, setState] = useState<'rising' | 'ready' | 'spinning' | 'shown'>('rising');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const reduce = reduceMotion();
    controls.set({ y: reduce ? 0 : '80vh', rotateX: reduce ? 0 : 42, rotateY: 0, rotateZ: reduce ? 0 : -6, scale: 0.9, opacity: reduce ? 1 : 0.3 });
    controls
      .start({
        y: 0,
        rotateX: 6,
        rotateZ: 0,
        scale: 1,
        opacity: 1,
        transition: reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 70, damping: 15, mass: 1, opacity: { duration: 0.35 } }
      })
      .then(() => alive.current && setState((st) => (st === 'rising' ? 'ready' : st)));
    // Fallback: never let a paused animation (background tab) block the reveal.
    const tm = setTimeout(() => alive.current && setState((st) => (st === 'rising' ? 'ready' : st)), 1100);
    return () => {
      alive.current = false;
      clearTimeout(tm);
    };
  }, []);

  const reveal = async () => {
    if (state !== 'ready' && state !== 'rising') return;
    setState('spinning');
    controls.stop();
    sfx.cardSpin();
    const reduce = reduceMotion();
    if (reduce) {
      controls.set({ rotateY: 180, rotateX: 0, rotateZ: 0 });
    } else {
      // One continuous ease-out spin (2.5 turns, lands face up). The wobble is a decaying sine
      // sampled densely and played linearly, so there are no per-keyframe speed changes.
      const N = 48;
      const DUR = 2.5;
      const times = Array.from({ length: N + 1 }, (_, i) => i / N);
      const decay = (p: number) => (1 - p) * (1 - p);
      const wobZ = times.map((p) => 10 * Math.sin(p * Math.PI * 3.2) * decay(p));
      const wobX = times.map((p) => 6 + (12 * Math.sin(p * Math.PI * 2.6 + 0.6) - 6) * decay(p) - 6 * (1 - decay(p)));
      const lift = times.map((p) => -36 * Math.sin(Math.PI * Math.min(1, p * 1.25)) * (1 - p));
      const grow = times.map((p) => 1 + 0.09 * Math.sin(Math.PI * Math.min(1, p * 1.15)));
      const spin = controls.start({
        rotateY: 900,
        rotateZ: wobZ,
        rotateX: wobX,
        y: lift,
        scale: grow,
        opacity: 1,
        transition: {
          rotateY: { duration: DUR, ease: [0.12, 0.8, 0.22, 1] },
          rotateZ: { duration: DUR, ease: 'linear', times },
          rotateX: { duration: DUR, ease: 'linear', times },
          y: { duration: DUR, ease: 'linear', times },
          scale: { duration: DUR, ease: 'linear', times }
        }
      });
      await Promise.race([spin, new Promise((r) => setTimeout(r, DUR * 1000 + 400))]);
      controls.set({ rotateY: 180, rotateX: 0, rotateZ: 0, y: 0, scale: 1, opacity: 1 });
    }
    if (!alive.current) return;
    sfx.reveal();
    setState('shown');
    onRevealed?.();
    // landing settle
    controls.start({ scale: [1, 1.035, 1], transition: { duration: 0.45, ease: [0.3, 1.4, 0.5, 1] } });
  };

  const teamColor = r.team === 'mafia' ? 'rgb(var(--c-danger))' : r.team === 'town' ? 'rgb(var(--c-fg))' : '#c49cff';

  return (
    <div className="mx-auto h-[25rem] w-[17rem] select-none sm:h-[27rem] sm:w-[18.5rem]" style={{ perspective: 1100 }}>
      <motion.div
        className={`relative h-full w-full ${state === 'ready' || state === 'rising' ? 'cursor-pointer' : 'cursor-default'}`}
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        animate={controls}
        onClick={reveal}
        role="button"
        aria-label={state === 'shown' ? t(`Your role: ${t(r.name)}`) : t('Reveal your role')}
      >
        {/* back: sealed case file */}
        <div className="absolute inset-0 flex flex-col overflow-hidden border border-line bg-panel" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: '0 20px 40px -18px rgb(0 0 0 / 0.9)' }}>
          <div className="flex items-center justify-between border-b border-line px-3 py-2 text-[10px] font-bold tracking-[0.2em] text-muted">
            <span>{t("SUBJECT FILE")}</span>
            <span>{t("EYES ONLY")}</span>
          </div>
          <div className="relative flex flex-1 flex-col items-center justify-center" style={{ background: 'repeating-linear-gradient(135deg, rgb(var(--c-accent) / 0.07) 0 10px, transparent 10px 20px)' }}>
            <div className={`flex h-24 w-24 items-center justify-center border border-accent/70 bg-ink text-accent ${state === 'ready' ? 'pulse-ring' : ''}`}>
              <Icon name="eye" size={48} strokeWidth={1.3} />
            </div>
            <div className="absolute left-1/2 top-[62%] -translate-x-1/2 -rotate-12 border-2 border-danger px-3 py-1 font-display text-2xl uppercase tracking-widest text-danger opacity-90">{t("Classified")}</div>
            <div className="shimmer pointer-events-none absolute inset-0" />
          </div>
          <div className="border-t border-line px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.25em] text-fg">
            {state === 'ready' ? <span className="cursor-blink">{t("Tap to decrypt")}</span> : state === 'spinning' ? t('Decrypting…') : t('Incoming file')}
          </div>
        </div>
        {/* front: role dossier */}
        <div
          className="absolute inset-0 flex flex-col overflow-hidden border bg-panel"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderColor: r.color, boxShadow: state === 'shown' ? `0 0 0 1px ${r.color}55, 0 0 60px -15px ${r.color}aa` : 'none' }}
        >
          {state === 'shown' && <motion.div className="pointer-events-none absolute inset-0 z-10" initial={{ x: '-120%' }} animate={{ x: '120%' }} transition={{ duration: 0.9, ease: 'easeOut' }} style={{ background: 'linear-gradient(105deg, transparent 35%, rgb(255 255 255 / 0.22) 50%, transparent 65%)' }} />}
          <div className="flex items-center justify-between px-3 py-2 text-[10px] font-bold tracking-[0.2em]" style={{ background: r.color, color: 'rgb(var(--c-bg))' }}>
            <span>{t('{team} team', { team: TEAM_LABEL[r.team] }).toUpperCase()}</span>
            <span>{t('FILE')} {r.icon}</span>
          </div>
          <div className="relative flex shrink-0 items-center justify-center py-4" style={{ background: `radial-gradient(circle at 50% 50%, ${r.color}26, transparent 70%)` }}>
            <div className="flex h-24 w-24 items-center justify-center border" style={{ borderColor: r.color + '88', color: r.color }}>
              <RoleIcon role={role} size={56} />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-3 text-center">
            <h2 className="title glitch text-[2.3rem] leading-none" style={{ color: r.color }}>{t(r.name)}</h2>
            <p className="scrollbar-thin mt-2 min-h-0 flex-1 overflow-y-auto text-[11.5px] leading-[1.55] text-fg/85">{t(r.description)}</p>
            <div className="shrink-0 pt-2 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: teamColor }}>{t("Eyes only \u00b7 do not show")}</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
