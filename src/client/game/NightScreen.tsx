import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { ClientView, NightPrompt } from '../../engine';
import { ROLES, EVENTS } from '../../engine';
import type { NightActionKind } from '../../engine/game';
import { PlayerCard, PlayerGrid } from '../components/PlayerGrid';
import { Button, Panel } from '../components/ui';
import { Chat } from '../components/Chat';
import { Timer } from '../components/Timer';
import { Avatar } from '../components/Avatar';
import type { GameActions } from './types';
import { t } from '../lib/i18n';
import { NightTask } from './NightTask';
import { SleepOverlay } from '../components/ScreenFx';
import { DetectiveNotebook } from '../components/Notebook';
import { Icon, RoleIcon } from '../components/Icon';

const PROMPT_TITLE: Record<NightPrompt['kind'], { title: string; verb: string }> = {
  mafia: { title: 'Choose a victim', verb: 'Eliminate' },
  detective: { title: 'Investigate a player', verb: 'Investigate' },
  doctor: { title: 'Protect a player', verb: 'Protect' },
  bodyguard: { title: 'Choose who to guard (permanent)', verb: 'Guard' },
  sheriff: { title: 'Take a shot', verb: 'Shoot' },
  silencer: { title: 'Silence a player', verb: 'Silence' },
  survivor: { title: 'Wear a bulletproof vest tonight?', verb: 'Wear vest' },
  cupid: { title: 'Choose two lovers', verb: 'Bind' },
  baker: { title: 'Deliver bread', verb: 'Deliver' },
  none: { title: 'Tonight', verb: '' }
};

type Pick = string | null | boolean | string[];

export function NightScreen({ view, actions }: { view: ClientView; actions: GameActions }) {
  const me = view.me!;
  const role = ROLES[me.role];
  const prompts = view.nightPrompts;
  const [local, setLocal] = useState<Record<string, Pick | undefined>>({});
  const spectating = !me.alive;
  const allSubmitted = prompts.every((p) => p.submitted);
  const idle = prompts.length > 0 && prompts.every((p) => p.kind === 'none');
  const [taskDone, setTaskDone] = useState(false);
  const ready = allSubmitted && (!idle || taskDone || actions.mode === 'online');
  const isMafiaTeam = me.allies.length > 0 || role.team === 'mafia';
  const [awake, setAwake] = useState(false);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    if (!allSubmitted) return;
    const tm = setTimeout(() => setSettled(true), idle ? 900 : 4500);
    return () => clearTimeout(tm);
  }, [allSubmitted, idle, awake]);
  const asleep = actions.mode === 'online' && !spectating && allSubmitted && settled && !awake && (idle || !isMafiaTeam);
  const event = view.activeEvent ? EVENTS[view.activeEvent] : null;
  const lover = me.loverId ? view.players.find((p) => p.id === me.loverId) : null;

  const pick = (kind: NightActionKind, value: Pick) => {
    setLocal((l) => ({ ...l, [kind]: value }));
    actions.nightAction(kind, value);
    setAwake(false);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4">
      <SleepOverlay open={asleep} canWake={!idle} onWake={() => setAwake(true)} endsAt={view.phaseEndsAt} startedAt={view.phaseStartedAt} offset={actions.clockOffset} />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="glass flex items-center gap-3 p-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center border" style={{ color: role.color, borderColor: role.color + '88' }}><RoleIcon role={me.role} size={26} /></span>
          <div className="min-w-0">
            <div className="title text-3xl" style={{ color: role.color }}>{t(role.name)}</div>
            <div className="text-xs text-muted">{spectating ? t('You are dead. Watch the night unfold.') : t(role.short)}</div>
          </div>
        </div>
        {actions.mode === 'online' && <div className="w-full md:w-64"><Timer endsAt={view.phaseEndsAt} startedAt={view.phaseStartedAt} offset={actions.clockOffset} label={t('Night {n}', { n: view.day })} /></div>}
      </div>

      {lover && !spectating && (
        <div className="mb-4 flex items-center gap-2 border border-pink-400/60 bg-pink-400/5 p-3 text-[13px] text-pink-200">
          <Icon name="cupid" size={16} /> {t('You are in love with {name}. If one of you dies, so does the other.', { name: lover.name })}
        </div>
      )}

      {event && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 border border-accent2/50 bg-accent2/5 p-3 text-[13px]">
          <Icon name={event.id} size={16} className="mr-2 align-[-3px] text-accent2" />
          <strong>{t(event.name)}:</strong> {t(event.description)}
        </motion.div>
      )}

      <div className={`grid gap-4 ${me.allies.length && actions.mode === 'online' ? 'lg:grid-cols-[1fr_20rem]' : ''}`}>
        <div className="space-y-4">
          {spectating ? (
            <Panel title={t('Spectating')}>
              <p className="text-sm text-muted">{t('The living are making their moves in secret. As a spirit you can see every role.')}</p>
              <div className="mt-3"><PlayerGrid>{view.players.map((p) => <PlayerCard key={p.id} p={p} small meId={me.id} />)}</PlayerGrid></div>
            </Panel>
          ) : (
            prompts.map((prompt) => <PromptPanel key={prompt.kind} prompt={prompt} view={view} localValue={local[prompt.kind]} onPick={pick} task={<NightTask seed={`${view.id}-${me.id}-${view.day}`} onDone={() => setTaskDone(true)} />} />)
          )}

          {!spectating && <DetectiveNotebook view={view} />}
          {!spectating && actions.mode === 'local' && (
            <Button size="lg" className="w-full" disabled={!ready} onClick={() => actions.done?.()}>
              {ready ? t('Done — pass the device') : idle ? t('Finish your task to continue') : t('Choose or skip to continue')}
            </Button>
          )}
          {!spectating && actions.mode === 'online' && (
            <div className="text-center text-sm text-muted">{allSubmitted ? t('Your choice is locked in. You can still change it until night ends.') : t('Make your move before the night ends.')}</div>
          )}
          {!spectating && actions.mode === 'online' && (
            <Panel title={t('Town · {n} alive', { n: view.players.filter((p) => p.alive).length })}>
              <PlayerGrid cols="grid-cols-4 sm:grid-cols-6 md:grid-cols-8">{view.players.map((p) => <PlayerCard key={p.id} p={p} small meId={me.id} />)}</PlayerGrid>
            </Panel>
          )}
        </div>

        {me.allies.length > 0 && actions.mode === 'online' && (
          <Panel title={t('Mafia den')} className="flex h-[26rem] flex-col">
            <div className="mb-2 flex flex-wrap gap-2">
              {view.players.filter((p) => p.id === me.id || me.allies.includes(p.id)).map((a) => {
                const tg = view.mafiaTargetVotes?.[a.id];
                const tp = tg ? view.players.find((p) => p.id === tg) : null;
                return (
                  <div key={a.id} className="flex items-center gap-1.5 bg-ink/50 px-2 py-1 text-xs">
                    <Avatar index={a.avatar} photo={a.photo} size={22} ring={false} />
                    <span className={`font-semibold ${!a.alive ? 'line-through opacity-60' : ''}`}>{a.name}</span>
                    {a.alive && <span className="text-muted">→ {tg === undefined ? '…' : tp ? tp.name : t('no kill')}</span>}
                  </div>
                );
              })}
            </div>
            <Chat messages={view.chat} channel="mafia" meId={me.id} onSend={(x) => actions.chat(x, 'mafia')} disabled={!view.settings.mafiaChat ? t('Mafia chat disabled') : !me.alive ? t('You are dead') : false} />
          </Panel>
        )}
        {spectating && actions.mode === 'online' && (
          <Panel title={t('Graveyard chat')} className="flex h-80 flex-col"><Chat messages={view.chat} channel="dead" meId={me.id} onSend={(x) => actions.chat(x, 'dead')} /></Panel>
        )}
      </div>
    </div>
  );
}

function PromptPanel({ prompt, view, localValue, onPick, task }: { prompt: NightPrompt; view: ClientView; localValue: Pick | undefined; onPick: (k: NightActionKind, v: Pick) => void; task?: React.ReactNode }) {
  const meta = PROMPT_TITLE[prompt.kind];
  const current = localValue !== undefined ? localValue : prompt.current;
  const [pair, setPair] = useState<string[]>(Array.isArray(prompt.current) ? prompt.current : []);
  const lockedChip = (label: string) => <span className="chip !border-accent2/60 !text-accent2"><Icon name="check" size={11} /> {label}</span>;

  if (prompt.kind === 'none') {
    return (
      <Panel title={t('Tonight')}>
        <p className="text-sm text-fg/90">{prompt.note ? t(prompt.note) : ''}</p>
        <p className="mb-3 mt-2 text-xs text-muted">{t('Do your night chores so nobody can tell you have no ability.')}</p>
        {task}
      </Panel>
    );
  }
  if (prompt.kind === 'survivor') {
    return (
      <Panel title={t(meta.title)} right={prompt.submitted && lockedChip(t('locked'))}>
        {prompt.note && <p className="mb-3 text-xs text-muted">{t(prompt.note)}</p>}
        <div className="flex gap-2">
          <Button variant={current === true ? 'primary' : 'ghost'} className="flex-1" onClick={() => onPick('survivor', true)}><Icon name="survivor" size={16} /> {t('Wear vest')}</Button>
          <Button variant={current === false && prompt.submitted ? 'primary' : 'ghost'} className="flex-1" onClick={() => onPick('survivor', false)}>{t('Stay exposed')}</Button>
        </div>
      </Panel>
    );
  }
  if (prompt.kind === 'cupid') {
    const toggle = (id: string) => {
      const next = pair.includes(id) ? pair.filter((x) => x !== id) : [...pair, id].slice(-2);
      setPair(next);
      if (next.length === 2) onPick('cupid', next);
    };
    const done = prompt.submitted && Array.isArray(current) && current.length === 2;
    return (
      <Panel title={t(meta.title)} right={prompt.submitted && lockedChip(done ? t('Bound') : t('skipped'))}>
        {prompt.note && <p className="mb-3 text-xs text-muted">{t(prompt.note)}</p>}
        <p className="mb-2 text-[12px] text-pink-200">{t('{n} of 2 chosen', { n: pair.length })}</p>
        <PlayerGrid>
          {prompt.targets.map((id) => {
            const p = view.players.find((x) => x.id === id)!;
            return <PlayerCard key={id} p={p} selected={pair.includes(id)} onSelect={() => toggle(id)} meId={view.me?.id} />;
          })}
        </PlayerGrid>
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant={prompt.submitted && current === null ? 'primary' : 'ghost'} onClick={() => { setPair([]); onPick('cupid', null); }}>{t('No lovers')}</Button>
        </div>
      </Panel>
    );
  }
  const kind = prompt.kind as NightActionKind;
  return (
    <Panel title={t(meta.title)} right={prompt.submitted && lockedChip(current ? t(meta.verb) : t('skipped'))}>
      {prompt.note && <p className="mb-3 text-xs text-muted">{t(prompt.note)}</p>}
      <PlayerGrid>
        {prompt.targets.map((id) => {
          const p = view.players.find((x) => x.id === id)!;
          return <PlayerCard key={id} p={p} selected={current === id} onSelect={() => onPick(kind, id)} meId={view.me?.id} />;
        })}
      </PlayerGrid>
      {prompt.canSkip && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant={prompt.submitted && current === null ? 'primary' : 'ghost'} onClick={() => onPick(kind, null)}>
            {kind === 'bodyguard' ? t('Decide later') : t('Skip tonight')}
          </Button>
        </div>
      )}
    </Panel>
  );
}
