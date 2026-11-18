import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { ClientView, Verdict } from '../../engine';
import { Button, Panel } from '../components/ui';
import { Avatar } from '../components/Avatar';
import { Timer } from '../components/Timer';
import { Chat } from '../components/Chat';
import { Icon } from '../components/Icon';
import { sfx } from '../lib/audio';
import { t } from '../lib/i18n';
import type { GameActions } from './types';

/**
 * The trial: during `defense` only the accused speaks; during `judgment` everyone else votes
 * guilty or innocent. `voterId` is set for a local secret-ballot turn.
 */
export function TrialScreen({ view, actions, voterId }: { view: ClientView; actions: GameActions; voterId?: string }) {
  const trial = view.trial;
  const accused = trial ? view.players.find((p) => p.id === trial.accused) : null;
  const judging = view.phase === 'judgment';
  const me = view.me;
  const voter = voterId ?? me?.id ?? null;
  const voterP = voter ? view.players.find((p) => p.id === voter) : null;
  const canJudge = judging && !!voterP && voterP.alive && voter !== trial?.accused;
  const [picked, setPicked] = useState<Verdict | null>(null);
  const mine = picked ?? trial?.myVerdict ?? null;
  useEffect(() => setPicked(null), [voterId, view.phase]);
  if (!trial || !accused) return null;

  const cast = (v: Verdict) => {
    if (!canJudge) return;
    if (v === 'guilty') sfx.gavel();
    else sfx.select();
    setPicked(v);
    actions.judge(v);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-8 pt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="title text-5xl">{judging ? t('Judgment') : t('Defense')}</h2>
          <p className="text-xs text-muted">{judging ? t('Guilty means execution. Not guilty means they walk free.') : t('The accused has the floor. Everyone else, listen.')}</p>
        </div>
        {(actions.mode === 'online' || !judging) && (
          <div className="w-full sm:w-64">
            <Timer endsAt={view.phaseEndsAt} startedAt={view.phaseStartedAt} offset={actions.clockOffset} label={judging ? 'Judgment ends in' : 'Defense ends in'} />
          </div>
        )}
      </div>

      <div className={`grid gap-4 ${actions.mode === 'online' ? 'lg:grid-cols-[1fr_20rem]' : ''}`}>
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass flex flex-col items-center p-6 text-center">
            <div className="label">{t('On trial')}</div>
            <motion.div className="mt-4" animate={judging ? {} : { rotate: [0, -1.5, 1.5, 0] }} transition={{ repeat: Infinity, duration: 2.4 }}>
              <Avatar index={accused.avatar} photo={accused.photo} size={104} />
            </motion.div>
            <h3 className="title glitch mt-4 text-5xl">{accused.name}</h3>
            <p className="mt-2 max-w-md text-[13px] text-fg/80">
              {judging
                ? t('{n} of {total} have voted.', { n: trial.voted, total: trial.voters })
                : actions.mode === 'local'
                  ? t('{name}, stand up and defend yourself out loud.', { name: accused.name })
                  : t('{name} is defending themselves in the town square.', { name: accused.name })}
            </p>
          </motion.div>

          {judging && voterId && voterP && (
            <div className="glass flex items-center gap-3 p-3">
              <Avatar index={voterP.avatar} photo={voterP.photo} size={40} />
              <div>
                <div className="font-semibold">{t('{name}, cast your verdict', { name: voterP.name })}</div>
                <div className="text-xs text-muted">{t('Your choice is secret.')}</div>
              </div>
            </div>
          )}

          {judging && (
            <Panel title="Verdict">
              {canJudge ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <VerdictButton active={mine === 'guilty'} tone="danger" icon="skull" label="Guilty" onClick={() => cast('guilty')} />
                  <VerdictButton active={mine === 'innocent'} tone="good" icon="check" label="Not guilty" onClick={() => cast('innocent')} />
                  <VerdictButton active={mine === 'abstain'} tone="muted" icon="skip" label="Abstain" onClick={() => cast('abstain')} />
                </div>
              ) : (
                <p className="text-sm text-muted">{voter === trial.accused ? t('You are on trial. You cannot vote.') : t('Only the living can judge.')}</p>
              )}
            </Panel>
          )}

          {judging && voterId && (
            <Button size="lg" className="w-full" disabled={!mine} onClick={() => actions.done?.()}>
              Confirm & pass the device
            </Button>
          )}
          {!judging && (actions.isHost || actions.mode === 'local') && (
            <Button size="lg" variant="danger" className="w-full" onClick={() => { sfx.gavel(); actions.skipPhase(); }}>
              {actions.mode === 'local' ? 'Continue to judgment' : 'End defense & judge now'}
            </Button>
          )}
        </div>

        {actions.mode === 'online' && me && (
          <Panel title={me.alive ? 'Town square' : 'Graveyard chat'} className="flex h-[24rem] flex-col lg:h-auto">
            {me.alive ? (
              <Chat
                messages={view.chat}
                channel="public"
                meId={me.id}
                onSend={(x) => actions.chat(x, 'public')}
                disabled={me.silenced ? 'You have been silenced today' : !judging && me.id !== trial.accused ? 'Only the accused may speak' : false}
              />
            ) : (
              <Chat messages={view.chat} channel="dead" meId={me.id} onSend={(x) => actions.chat(x, 'dead')} />
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

function VerdictButton({ active, tone, icon, label, onClick }: { active: boolean; tone: 'danger' | 'good' | 'muted'; icon: string; label: string; onClick: () => void }) {
  const color = tone === 'danger' ? 'rgb(var(--c-danger))' : tone === 'good' ? 'rgb(var(--c-accent2))' : 'rgb(var(--c-muted))';
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      aria-pressed={active}
      className="flex flex-col items-center gap-2 border px-4 py-5 text-[13px] font-bold uppercase tracking-[0.15em] transition"
      style={{ borderColor: color, color: active ? 'rgb(var(--c-bg))' : color, background: active ? color : 'transparent', boxShadow: active ? `0 0 30px -8px ${color}` : undefined }}
    >
      <Icon name={icon} size={30} />
      {t(label)}
    </motion.button>
  );
}

/** Local open-table judgment: everyone sees the verdicts as they are entered. */
export function OpenJudgment({ view, onJudge, onCount }: { view: ClientView; onJudge: (voterId: string, v: Verdict) => void; onCount: () => void }) {
  const trial = view.trial;
  const [marks, setMarks] = useState<Record<string, Verdict>>({});
  if (!trial) return null;
  const accused = view.players.find((p) => p.id === trial.accused)!;
  const voters = view.players.filter((p) => p.alive && p.id !== trial.accused);
  const set = (id: string, v: Verdict) => {
    sfx.vote();
    setMarks((m) => ({ ...m, [id]: v }));
    onJudge(id, v);
  };
  const guilty = Object.values(marks).filter((v) => v === 'guilty').length;
  const innocent = Object.values(marks).filter((v) => v === 'innocent').length;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-4">
      <h2 className="title text-5xl">{t('Judgment')}</h2>
      <p className="mb-4 text-xs text-muted">{t('Is {name} guilty? Mark each player out loud.', { name: accused.name })}</p>
      <Panel title="Open verdicts" right={<span className="chip">{t('Guilty')} {guilty} · {t('Not guilty')} {innocent}</span>}>
        <div className="divide-y divide-line/50">
          {voters.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2">
              <Avatar index={p.avatar} photo={p.photo} size={32} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold uppercase">{p.name}</span>
              {(['guilty', 'innocent'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set(p.id, v)}
                  className={`border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider ${marks[p.id] === v ? (v === 'guilty' ? 'border-danger bg-danger text-ink' : 'border-accent2 bg-accent2 text-ink') : 'border-line text-muted'}`}
                >
                  {v === 'guilty' ? t('Guilty') : t('Not guilty')}
                </button>
              ))}
            </div>
          ))}
        </div>
      </Panel>
      <Button size="lg" className="mt-4 w-full" onClick={() => { sfx.gavel(); onCount(); }}>
        Count the verdicts
      </Button>
    </div>
  );
}
