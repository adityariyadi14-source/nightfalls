import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ClientView } from '../../engine';
import { ROLES, TEAM_LABEL } from '../../engine';
import { Button, Panel } from '../components/ui';
import { Avatar } from '../components/Avatar';
import { RoleBadge } from '../components/RoleBadge';
import { LogFeed } from '../components/LogFeed';
import { sfx } from '../lib/audio';
import { navigate } from '../lib/router';
import type { GameActions } from './types';
import { t } from '../lib/i18n';
import { Icon, RoleIcon } from '../components/Icon';

export function ResultsScreen({ view, actions }: { view: ClientView; actions: GameActions }) {
  const win = view.winner!;
  const me = view.me;
  const iWon = me ? win.winners.includes(me.id) : null;
  useEffect(() => {
    sfx.stinger(win.team);
  }, []);
  const color = win.team === 'mafia' ? 'rgb(var(--c-danger))' : win.team === 'town' ? 'rgb(var(--c-fg))' : '#c49cff';
  const title = win.team === 'draw' ? t('Draw') : win.team === 'town' ? t('The Town Wins') : win.team === 'mafia' ? t('The Mafia Wins') : t('{team} Wins', { team: TEAM_LABEL[win.team] });
  const winners = view.players.filter((p) => win.winners.includes(p.id));
  const others = view.players.filter((p) => !win.winners.includes(p.id));
  const duration = view.phaseStartedAt && view.log[0] ? Math.max(1, Math.round((view.phaseStartedAt - view.log[0].ts) / 60000)) : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-6">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', bounce: 0.35 }} className="glass relative overflow-hidden p-8 text-center">
        <Confetti color={color} />
        <div className="flex justify-center" style={{ color }}><Icon name={win.team === 'mafia' ? 'mafia' : win.team === 'town' ? 'citizen' : win.team === 'draw' ? 'skull' : 'jester'} size={64} strokeWidth={1.2} /></div>
        <h1 className="title glitch mt-4 text-[clamp(3rem,11vw,6rem)]" style={{ color, textShadow: `-2px 0 ${color}88, 2px 0 rgb(var(--c-accent2) / 0.3)` }}>{title}</h1>
        <p className="mt-2 text-muted">{t(win.reason)}</p>
        {iWon !== null && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className={`mt-3 text-lg font-bold ${iWon ? 'text-accent2' : 'text-danger'}`}>
            {iWon ? t('You win!') : t('You lose.')}
          </motion.p>
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-muted">
          <span className="chip">{t(view.day === 1 ? '{n} day' : '{n} days', { n: view.day })}</span>
          {duration && <span className="chip">{t('~{n} min', { n: duration })}</span>}
          <span className="chip">{t('{n} players', { n: view.players.length })}</span>
          {view.eventHistory.length > 0 && <span className="chip">{view.eventHistory.length} event{view.eventHistory.length === 1 ? '' : 's'}</span>}
        </div>
      </motion.div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel title={t(`Winners · ${winners.length}`)}>
          <div className="space-y-2">{winners.map((p, i) => <Row key={p.id} p={p} i={i} won />)}</div>
        </Panel>
        <Panel title={t(`Everyone else · ${others.length}`)}>
          <div className="space-y-2">{others.map((p, i) => <Row key={p.id} p={p} i={i} />)}</div>
        </Panel>
      </div>
      <Panel title={t("How it happened")} className="mt-4"><LogFeed log={view.log} limit={200} className="!max-h-80" /></Panel>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {(actions.isHost || actions.mode === 'local') && <Button size="lg" onClick={() => actions.playAgain()}>{t("Play again")}</Button>}
        {actions.mode === 'online' && !actions.isHost && <span className="self-center text-sm text-muted">{t("Waiting for the host to start a new round\u2026")}</span>}
        <Button size="lg" variant="ghost" onClick={() => navigate('/stats')}>{t("Statistics")}</Button>
        <Button size="lg" variant="ghost" onClick={() => actions.leave()}>{actions.mode === 'online' ? t('Leave room') : t('Main menu')}</Button>
      </div>
    </div>
  );
}

function Row({ p, i, won }: { p: { id: string; name: string; avatar: number; photo?: string; alive: boolean; role: import('../../engine').RoleId | null }; i: number; won?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }} className={`flex items-center gap-3 border px-3 py-2 ${won ? 'border-accent2/40 bg-accent2/5' : 'border-line/50 bg-ink/30'}`}>
      <Avatar index={p.avatar} photo={p.photo} size={36} dead={!p.alive} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate font-semibold">{p.name} {!p.alive && <span title="Died" className="text-danger"><Icon name="skull" size={14} /></span>}</div>
        {p.role && <div className="text-[11px] text-muted">{t(ROLES[p.role].short)}</div>}
      </div>
      {p.role && <RoleBadge role={p.role} />}
    </motion.div>
  );
}

function Confetti({ color }: { color: string }) {
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((i) => (
        <motion.span
          key={i}
          className="absolute block h-2 w-1"
          style={{ left: `${(i * 37) % 100}%`, top: -10, background: i % 3 ? color : '#fff' }}
          initial={{ y: -20, opacity: 0, rotate: 0 }}
          animate={{ y: 420, opacity: [0, 1, 1, 0], rotate: 720 }}
          transition={{ duration: 3 + (i % 5) * 0.4, delay: (i % 7) * 0.2, repeat: Infinity, repeatDelay: 2 }}
        />
      ))}
    </div>
  );
}
