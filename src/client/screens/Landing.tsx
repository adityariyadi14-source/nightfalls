import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui';
import { navigate } from '../lib/router';
import { ROLES, ROLE_ORDER } from '../../engine';
import { ONLINE_AVAILABLE } from '../lib/env';
import { t } from '../lib/i18n';
import { LangSwitch } from '../components/LangSwitch';
import { RoleIcon } from '../components/Icon';

const BOOT = [
  ['NIGHTFALL OS 3.1 // CURFEW PROTOCOL', ''],
  ['establishing secure channel', 'OK'],
  ['loading subject files [13 roles]', 'OK'],
  ['scanning population', '!! HOSTILES DETECTED'],
  ['trust level', '0%']
];

export function Landing() {
  const start = () => navigate(ONLINE_AVAILABLE ? '/menu' : '/local');
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Enter') start();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-4 py-10 sm:px-8">
      <div className="mb-6 flex justify-end"><LangSwitch /></div>
      <div className="space-y-1 text-[12px] text-muted sm:text-[13px]">
        {BOOT.map(([l, r], i) => (
          <motion.div key={l} className="flex gap-2" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.22, duration: 0.2 }}>
            <span className="text-accent">&gt;</span>
            <span className="min-w-0 truncate">{t(l)}</span>
            {r && <span className="flex-1 overflow-hidden whitespace-nowrap text-line">{'.'.repeat(60)}</span>}
            {r && <span className={r.startsWith('!!') ? 'font-bold text-danger' : 'text-accent2'}>{t(r)}</span>}
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 0.4 }} className="mt-8">
        <h1 className="title glitch text-glow text-[clamp(4.2rem,17vw,11.5rem)] leading-[0.85] text-fg">{t("Nightfall")}</h1>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="max-w-xl text-[14px] leading-relaxed text-fg/80 sm:text-[15px]">
            {ONLINE_AVAILABLE
              ? t('Someone in this town is a killer. Every night they strike. Every day you vote. Lie well, read people better, and survive until morning, online or around one phone.')
              : t('Someone in this town is a killer. Every night they strike. Every day you vote. Pass one phone around the table, keep your file secret, and survive until morning.')}
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={start}>{ONLINE_AVAILABLE ? t('Play now') : t('Start a game')}</Button>
          <Button size="lg" variant="ghost" onClick={() => navigate('/menu')}>{t("Menu")}</Button>
          <Button size="lg" variant="ghost" onClick={() => navigate('/rules')}>{t("How to play")}</Button>
        </div>
        <p className="mt-3 hidden text-[11px] uppercase tracking-[0.2em] text-muted sm:block">{t("Press")} <span className="border border-line px-1 text-fg">{t("Enter")}</span> {t("to begin")}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7 }} className="mt-12 border-y border-line/60 py-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {ROLE_ORDER.map((r) => (
            <span key={r} className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: ROLES[r].color }}>
              <RoleIcon role={r} size={14} /> {t(ROLES[r].name)}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
