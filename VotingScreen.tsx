import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ClientView } from '../../engine';
import { ROLES, EVENTS } from '../../engine';
import { Button, Panel } from '../components/ui';
import { Avatar } from '../components/Avatar';
import { Timer } from '../components/Timer';
import { sfx } from '../lib/audio';
import { Chat } from '../components/Chat';
import type { GameActions } from './types';
import { t } from '../lib/i18n';
import { LastWordsPrompt, LastWordsQuote } from '../components/LastWords';
import { Icon, RoleIcon } from '../components/Icon';

/** Live voting board. Used online, for local secret ballots (one voter) and the shared result screen. */
export function VotingScreen({ view, actions, voterId }: { view: ClientView; actions: GameActions; voterId?: string }) {
  const me = view.me;
  const voter = voterId ?? me?.id ?? null;
  const voterP = view.players.find((p) => p.id === voter);
  const canVote = !!voterP && voterP.alive && view.phase === 'voting';
  const alive = view.players.filter((p) => p.alive);
  const candidates = view.revoteCandidates ? alive.filter((p) => view.revoteCandidates!.includes(p.id)) : alive;
  const anonymous = view.activeEvent === 'anonymous_vote';
  const event = view.activeEvent ? EVENTS[view.activeEvent] : null;
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const myVote = picked !== undefined ? picked : view.myVote;
  const tally = view.voteTally;
  const voted = new Set((view.votes ?? []).map((v) => v.voterId));
  const votedCount = view.votes ? view.votes.length : Object.values(tally).reduce((a, b) => a + b, 0);
  const total = alive.length;

  useEffect(() => setPicked(undefined), [view.phase, view.revoteCandidates?.length]);

  const cast = (t: string | null) => {
    if (!canVote) return;
    sfx.vote();
    setPicked(t);
    actions.vote(t);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="title text-2xl font-black">{view.revoteCandidates ? t('Revote') : t('The Vote')} · {t('Day {n}', { n: view.day })}</h2>
          <p className="text-xs text-muted">{view.revoteCandidates ? t('Only the tied players can be chosen.') : view.settings.voteMode === 'majority' ? t('More than half of the town must agree.') : t('The player with the most votes is eliminated.')}</p>
        </div>
        {actions.mode === 'online' && <div className="w-full sm:w-64"><Timer endsAt={view.phaseEndsAt} startedAt={view.phaseStartedAt} offset={actions.clockOffset} label={t("Voting ends in")} /></div>}
      </div>

      {event && (
        <div className="mb-4 border border-accent2/50 bg-accent2/5 p-3 text-[13px]"><Icon name={event.id} size={16} className="mr-2 align-[-3px] text-accent2" /><strong>{t(event.name)}:</strong> {t(event.description)}</div>
      )}

      {voterId && voterP && (
        <div className="glass mb-4 flex items-center gap-3 rounded-2xl p-3">
          <Avatar index={voterP.avatar} photo={voterP.photo} size={40} />
          <div><div className="font-semibold">{t('{name}, cast your vote', { name: voterP.name })}</div><div className="text-xs text-muted">{t("Your choice is secret.")}</div></div>
        </div>
      )}

      <div className={`grid gap-4 ${actions.mode === 'online' ? 'lg:grid-cols-[1fr_20rem]' : ''}`}>
        <div className="space-y-4">
          <Panel title={t(`Ballot · ${votedCount}/${total} voted`)} right={anonymous && <span className="chip"><Icon name="anonymous_vote" size={11} /> {t("anonymous")}</span>}>
            <div className="grid gap-2 sm:grid-cols-2">
              {candidates.map((p) => {
                const n = tally[p.id] ?? 0;
                const voters = anonymous || !view.votes ? [] : view.votes.filter((v) => v.targetId === p.id).map((v) => view.players.find((x) => x.id === v.voterId)!);
                const mine = myVote === p.id;
                const self = p.id === voter;
                return (
                  <motion.button
                    layout
                    key={p.id}
                    disabled={!canVote || self}
                    onClick={() => cast(p.id)}
                    className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${mine ? 'border-danger bg-danger/15 shadow-[0_0_30px_-8px_rgb(var(--c-danger))]' : 'border-line/50 bg-panel/60 hover:border-accent/60'} disabled:cursor-default ${self ? 'opacity-60' : ''}`}
                  >
                    <motion.div className="absolute inset-y-0 left-0 bg-danger/20" initial={false} animate={{ width: `${total ? (n / total) * 100 : 0}%` }} transition={{ type: 'spring', bounce: 0.2 }} />
                    <div className="relative flex items-center gap-3">
                      <Avatar index={p.avatar} photo={p.photo} size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate font-semibold">{p.name}{p.silenced && <span title="Silenced" className="text-fuchsia-300"><Icon name="mute" size={13} /></span>}{p.id === view.doubleVoter && <span title={t("Town Elder")}>⚖️</span>}</div>
                        <div className="mt-1 flex min-h-[18px] flex-wrap gap-1">
                          <AnimatePresence>
                            {voters.map((v) => (
                              <motion.span key={v.id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} title={v.name}>
                                <Avatar index={v.avatar} photo={v.photo} size={18} ring={false} />
                              </motion.span>
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div className="font-display text-2xl font-black tabular-nums">{n}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted">
                {canVote ? (myVote === undefined ? t('Tap a player to vote.') : myVote === null ? t('You chose to skip.') : t(`You voted for ${view.players.find((p) => p.id === myVote)?.name}. Tap another to change.`)) : voterP && !voterP.alive ? t('You are dead and cannot vote.') : t('Waiting for votes…')}
              </div>
              <div className="flex items-center gap-2">
                {(tally.skip ?? 0) > 0 && <span className="chip">skip · {tally.skip}</span>}
                {view.settings.allowSkipVote && canVote && (
                  <Button size="sm" variant={myVote === null ? 'primary' : 'ghost'} onClick={() => cast(null)}>{t("Skip vote")}</Button>
                )}
              </div>
            </div>
          </Panel>

          {!anonymous && view.votes && actions.mode === 'online' && (
            <div className="flex flex-wrap gap-1.5">
              {alive.map((p) => (
                <span key={p.id} className={`chip ${voted.has(p.id) ? '!border-accent2/60 !text-accent2' : ''}`}>{voted.has(p.id) ? <Icon name="check" size={11} /> : '…'} {p.name}</span>
              ))}
            </div>
          )}

          {voterId && (
            <Button size="lg" className="w-full" disabled={myVote === undefined} onClick={() => actions.done?.()}>
              {t("Confirm & pass the device")}
            </Button>
          )}
        </div>
        {actions.mode === 'online' && me && (
          <Panel title={me.alive ? t('Town square') : t('Graveyard chat')} className="flex h-[24rem] flex-col lg:h-auto">
            {me.alive ? (
              <Chat messages={view.chat} channel="public" meId={me.id} onSend={(t) => actions.chat(t, 'public')} disabled={me.silenced ? t('You have been silenced today') : false} />
            ) : (
              <Chat messages={view.chat} channel="dead" meId={me.id} onSend={(t) => actions.chat(t, 'dead')} />
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

/** Dramatic result of a vote. */
export function VoteResultScreen({ view, actions }: { view: ClientView; actions: GameActions }) {
  const res = view.lastVote;
  const victim = res?.eliminated ? view.players.find((p) => p.id === res.eliminated) : null;
  const [stage, setStage] = useState(0);
  useEffect(() => {
    setStage(0);
    sfx.gavel();
    const a = setTimeout(() => setStage(1), 1200);
    const b = setTimeout(() => { setStage(2); if (victim) sfx.death(); }, 2600);
    const c = setTimeout(() => {
      setStage(3);
      res?.extraDeaths.forEach((d, i) => setTimeout(() => (d.cause === 'bomb' ? sfx.explosion() : sfx.heartbreak()), i * 500));
    }, 3800);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); };
  }, [res?.day, res?.eliminated]);
  const sorted = useMemo(() => Object.entries(res?.tally ?? {}).sort((a, b) => b[1] - a[1]), [res]);
  if (!res) return null;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-8 pt-6">
      <div className="w-full"><LastWordsPrompt view={view} actions={actions} /></div>
      <motion.div className="glass w-full rounded-3xl p-6 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <p className="label">{t('Day {n} · verdict', { n: view.day })}</p>
        {victim ? (
          <>
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: 'spring' }} className="my-5 flex flex-col items-center">
              <motion.div animate={stage >= 2 ? { filter: 'grayscale(1) brightness(0.5)', y: 10, rotate: -6 } : {}} transition={{ duration: 0.8 }}>
                <Avatar index={victim.avatar} photo={victim.photo} size={110} dead={stage >= 2} />
              </motion.div>
              <h2 className="title mt-4 text-3xl font-black">{victim.name}</h2>
              <AnimatePresence>
                {stage >= 1 && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-muted">{t("has been voted out of the town.")}</motion.p>
                )}
                {stage >= 2 && victim.role && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 rounded-2xl border px-5 py-3" style={{ borderColor: ROLES[victim.role].color + '88', background: ROLES[victim.role].color + '14' }}>
                    <div className="flex justify-center"><RoleIcon role={victim.role} size={40} /></div>
                    <div className="title text-xl font-bold" style={{ color: ROLES[victim.role].color }}>{t('They were the {role}', { role: ROLES[victim.role].name })}</div>
                    {res.jesterWin && <div className="mt-1 text-sm text-fuchsia-300">{t("The Jester wanted this. They win!")}</div>}
                  </motion.div>
                )}
                {stage >= 2 && !victim.role && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm text-muted">{t("Their role remains a mystery.")}</motion.p>}
                {stage >= 2 && victim.lastWords && <div className="mx-auto mt-4 max-w-sm"><LastWordsQuote text={victim.lastWords} /></div>}
                {stage >= 3 && res.extraDeaths.map((d) => {
                  const x = view.players.find((p) => p.id === d.playerId)!;
                  return (
                    <motion.div key={d.playerId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 flex items-center gap-3 border px-4 py-3 text-left ${d.cause === 'bomb' ? 'border-amber-400 bg-amber-400/10' : 'border-pink-400 bg-pink-400/10'}`}>
                      <Icon name={d.cause === 'bomb' ? 'bomb' : 'cupid'} size={28} className={d.cause === 'bomb' ? 'text-amber-300' : 'text-pink-300'} />
                      <div className="text-[13px]">
                        <div className="font-bold">{d.cause === 'bomb' ? t('{name} was a Bomb. The blast killed {other}.', { name: victim.name, other: x.name }) : t('{other} could not live without {name} and died of a broken heart.', { name: victim.name, other: x.name })}</div>
                        {x.role && <div className="mt-0.5 text-[11px] uppercase tracking-wider" style={{ color: ROLES[x.role].color }}>{t(ROLES[x.role].name)}</div>}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </>
        ) : (
          res.trial?.spared ? (
          <div className="my-6">
            <div className="flex justify-center"><Avatar index={view.players.find((p) => p.id === res.trial!.accused)?.avatar ?? 0} size={96} /></div>
            <h2 className="title mt-4 text-4xl text-accent2">{t('{name} walks free', { name: view.players.find((p) => p.id === res.trial!.accused)?.name ?? '' })}</h2>
            <p className="mt-1 text-sm text-muted">{t('The town found them not guilty.')}</p>
          </div>
          ) : (
          <div className="my-6">
            <div className="flex justify-center text-muted"><Icon name={res.tie ? 'double_vote' : 'x'} size={56} strokeWidth={1.3} /></div>
            <h2 className="title mt-3 text-2xl font-bold">{res.tie ? t('The vote is tied.') : t('No one is eliminated.')}</h2>
            <p className="mt-1 text-sm text-muted">{res.tie ? t('The town could not break the deadlock.') : t('The town could not reach a decision.')}</p>
          </div>
          )
        )}
        {res.trial && (
          <div className="mx-auto mb-4 max-w-sm border border-line/70 p-3 text-left">
            <div className="label mb-2 text-center">{t('Trial verdict')}</div>
            <div className="mb-2 flex items-baseline justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.15em]">
              <span className="text-danger">{t('Guilty')} <span className="font-mono text-base">{res.trial.guilty}</span></span>
              <span className="text-right text-accent2">{t('Not guilty')} <span className="font-mono text-base">{res.trial.innocent}</span></span>
            </div>
            <div className="flex h-2 overflow-hidden bg-line/50">
              <div className="bg-danger" style={{ width: `${(res.trial.guilty / Math.max(1, res.trial.guilty + res.trial.innocent)) * 100}%` }} />
              <div className="flex-1 bg-accent2/70" />
            </div>
            {res.trial.votes.length > 0 && view.activeEvent !== 'anonymous_vote' && (
              <div className="mt-2 flex flex-wrap gap-1">
                {res.trial.votes.map((v) => {
                  const p = view.players.find((x) => x.id === v.voterId);
                  return <span key={v.voterId} className={`chip !text-[10px] ${v.verdict === 'guilty' ? '!border-danger/60 !text-danger' : v.verdict === 'innocent' ? '!border-accent2/60 !text-accent2' : ''}`}>{p?.name}</span>;
                })}
              </div>
            )}
          </div>
        )}
        <div className="mx-auto mt-2 max-w-sm space-y-1.5 text-left">
          {sorted.map(([id, n]) => {
            const p = view.players.find((x) => x.id === id);
            return (
              <div key={id} className="flex items-center gap-2 text-sm">
                {p ? <Avatar index={p.avatar} photo={p.photo} size={22} ring={false} /> : <span className="w-[22px] text-center">⏭</span>}
                <span className="flex-1 truncate">{p ? p.name : t('Skip')}</span>
                <div className="h-2 w-28 overflow-hidden rounded-full bg-ink/70"><div className="h-full bg-danger" style={{ width: `${(n / Math.max(1, sorted[0][1])) * 100}%` }} /></div>
                <span className="w-5 text-right font-bold tabular-nums">{n}</span>
              </div>
            );
          })}
        </div>
        {actions.mode === 'online' && <div className="mx-auto mt-5 max-w-xs"><Timer endsAt={view.phaseEndsAt} startedAt={view.phaseStartedAt} offset={actions.clockOffset} label={t("Night falls in")} /></div>}
        {(actions.isHost || actions.mode === 'local') && view.phase === 'voteResult' && (
          <Button className="mt-4" onClick={() => actions.skipPhase()}>{t("Continue")}</Button>
        )}
      </motion.div>
    </div>
  );
}
