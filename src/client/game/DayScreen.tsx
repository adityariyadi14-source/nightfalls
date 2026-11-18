import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { ClientView } from '../../engine';
import { EVENTS, MAPS, ROLES } from '../../engine';
import { Button, Panel } from '../components/ui';
import { PlayerCard, PlayerGrid } from '../components/PlayerGrid';
import { Timer } from '../components/Timer';
import { LogFeed } from '../components/LogFeed';
import { Chat } from '../components/Chat';
import { Avatar } from '../components/Avatar';
import { sfx } from '../lib/audio';
import type { GameActions } from './types';
import { t } from '../lib/i18n';
import { LastWordsPrompt, LastWordsQuote } from '../components/LastWords';
import { ClueReveal, DetectiveNotebook } from '../components/Notebook';
import { Icon, RoleIcon } from '../components/Icon';

export function DayScreen({ view, actions }: { view: ClientView; actions: GameActions }) {
  const me = view.me;
  const announce = view.phase === 'dayAnnounce';
  const night = view.lastNight;
  const deaths = night?.deaths ?? [];
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (announce && night?.bread.length) setTimeout(() => sfx.bread(), 1500);
  }, [announce, view.day]);
  useEffect(() => {
    if (announce && deaths.length) {
      setFlash(true);
      deaths.forEach((d, i) =>
        setTimeout(() => {
          if (d.cause === 'sheriff' || d.cause === 'guilt') sfx.gunshot();
          else if (d.cause === 'bomb') sfx.explosion();
          else if (d.cause === 'heartbreak') sfx.heartbreak();
          else sfx.stab();
        }, 300 + i * 700)
      );
      const t = setTimeout(() => setFlash(false), 1700);
      return () => clearTimeout(t);
    }
  }, [announce, view.day]);
  const event = view.activeEvent ? EVENTS[view.activeEvent] : null;
  const alive = view.players.filter((p) => p.alive);
  const chatDisabled = !me ? t('Shared table') : !me.alive ? t('The dead cannot speak') : me.silenced ? t('You have been silenced today') : false;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4">
      {flash && <div className="flash-red" />}
      {flash && <Drips />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="title text-5xl">{t('Day {n}', { n: String(view.day).padStart(2, '0') })}</h2>
          <p className="text-xs text-muted">{announce ? t('The town wakes to the news.') : t('Discuss. Accuse. Defend.')}</p>
        </div>
        {actions.mode === 'online' || !announce ? <div className="w-full sm:w-64"><Timer endsAt={view.phaseEndsAt} startedAt={view.phaseStartedAt} offset={actions.clockOffset} label={announce ? t('Discussion starts in') : t('Discussion')} /></div> : null}
      </div>

      <LastWordsPrompt view={view} actions={actions} />

      {announce && night && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="glass mb-4 p-5 text-center">
          {deaths.length === 0 ? (
            <>
              <div className="flex justify-center text-accent2"><Icon name={night.peaceful ? 'peaceful_night' : 'eye'} size={44} strokeWidth={1.3} /></div>
              <h3 className="title mt-3 text-4xl">{night.peaceful ? t('A peaceful night.') : t('Nobody died last night.')}</h3>
              {(night.saved || night.guarded) && <p className="mt-1 text-sm text-accent2">{night.saved ? t('Someone was attacked but survived!') : t('A Bodyguard blocked an attack.')}</p>}
            </>
          ) : (
            <>
              <h3 className="title glitch text-4xl text-danger">{deaths.length === 1 ? t('A body was found') : t('{n} bodies were found', { n: deaths.length })}</h3>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted">{t('Crime scene · {map}', { map: MAPS[view.map]?.name ?? '' })}</p>
              <div className="mt-4 grid gap-3 text-left sm:grid-cols-2">
                {deaths.map((d, i) => {
                  const p = view.players.find((x) => x.id === d.playerId)!;
                  return (
                    <motion.article key={d.playerId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.6, duration: 0.4 }} className="border border-danger/70 bg-danger/[0.06]">
                      <header className="flex items-center justify-between bg-danger px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
                        <span>{t('Case file')} #{String(view.day).padStart(2, '0')}-{i + 1}</span>
                        {d.scene && <span className="tabular-nums">{t('T.O.D.')} {d.scene.time}</span>}
                      </header>
                      <div className="flex gap-3 p-3">
                        <div className="relative shrink-0">
                          <Avatar index={p.avatar} photo={p.photo} size={64} dead />
                        </div>
                        <div className="min-w-0 text-[12px] leading-relaxed">
                          <div className="title text-2xl">{p.name}</div>
                          {p.role && <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: ROLES[p.role].color }}><RoleIcon role={p.role} size={12} /> {t(ROLES[p.role].name)}</div>}
                        </div>
                      </div>
                      {p.lastWords && <div className="px-3 pb-2"><LastWordsQuote text={p.lastWords} /></div>}
                      {d.scene && (
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-danger/30 px-3 py-2 text-[12px]">
                          <dt className="text-muted">{t('Found')}</dt><dd className="min-w-0 text-fg">{t('in {room}', { room: d.scene.room })}</dd>
                          <dt className="text-muted">{t('Cause')}</dt><dd className="min-w-0 text-fg">{t(d.scene.method)}</dd>
                          <dt className="text-muted">{t('Clue')}</dt><dd className="min-w-0 text-accent2">{t(d.scene.clue)}</dd>
                        </dl>
                      )}
                    </motion.article>
                  );
                })}
              </div>
              {(night.saved || night.guarded) && <p className="mt-3 text-sm text-accent2">{night.saved ? t('Someone else was attacked but survived!') : t('A Bodyguard blocked another attack.')}</p>}
            </>
          )}
          {night.silenced && <p className="mt-3 text-sm text-fuchsia-300"><Icon name="mute" size={14} className="mr-1 align-[-2px]" />{t('{name} has been silenced and cannot speak today.', { name: view.players.find((p) => p.id === night.silenced)?.name })}</p>}
          {night.bread.length > 0 && <p className="mt-3 text-sm text-amber-200"><Icon name="baker" size={14} className="mr-1 align-[-2px]" />{t('{name} woke up to fresh bread. Their vote counts double today.', { name: night.bread.map((id) => view.players.find((p) => p.id === id)?.name).join(', ') })}</p>}
          {night.myClues && <ClueReveal clues={night.myClues} />}
          {night.myInvestigation && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mx-auto mt-4 max-w-sm border border-sky-400/50 bg-sky-400/5 p-3 text-sm">
              <Icon name="detective" size={14} className="mr-1 align-[-2px]" />{t('Your investigation:')} <strong>{view.players.find((p) => p.id === night.myInvestigation!.targetId)?.name}</strong> →{' '}
              <strong className={night.myInvestigation.result === 'suspicious' ? 'text-danger' : 'text-accent2'}>{t(night.myInvestigation.result === 'suspicious' ? 'SUSPICIOUS' : 'INNOCENT')}</strong>
              <span className="block text-[11px] text-muted">{t("Only you can see this.")}</span>
            </motion.div>
          )}
          {(actions.isHost || actions.mode === 'local') && (
            <Button className="mt-5" onClick={() => actions.skipPhase()}>{actions.mode === 'local' ? t('Begin discussion') : t('Skip to discussion')}</Button>
          )}
        </motion.div>
      )}

      {event && !announce && (
        <div className="mb-4 rounded-2xl border border-accent2/40 bg-accent2/10 p-3 text-sm">
          <Icon name={event.id} size={16} className="mr-2 align-[-3px] text-accent2" /><strong>{t(event.name)}:</strong> {t(event.description)}
          {view.doubleVoter && <span className="ml-1">{t("Elder:")} <strong>{view.players.find((p) => p.id === view.doubleVoter)?.name}</strong>.</span>}
        </div>
      )}

      <div className={`grid gap-4 ${actions.mode === 'online' ? 'lg:grid-cols-[1fr_22rem]' : ''}`}>
        <div className="space-y-4">
          <Panel title={t(`Town · ${alive.length} alive`)}>
            <PlayerGrid>{view.players.map((p) => <PlayerCard key={p.id} p={p} meId={me?.id} small />)}</PlayerGrid>
          </Panel>
          {!announce && <DetectiveNotebook view={view} />}
          {!announce && (
            <Panel title={t("Chronicle")}><LogFeed log={view.log} /></Panel>
          )}
          {!announce && (actions.isHost || actions.mode === 'local') && (
            <Button size="lg" className="w-full" variant="danger" onClick={() => { sfx.gavel(); actions.skipPhase(); }}>
              {actions.mode === 'local' ? t('Open the vote') : t('End discussion & vote now')}
            </Button>
          )}
        </div>
        {actions.mode === 'online' && (
          <Panel title={me && !me.alive ? t('Graveyard chat') : t('Town square')} className="flex h-[28rem] flex-col lg:h-auto lg:min-h-[28rem]">
            {me && !me.alive ? (
              <Chat messages={view.chat} channel="dead" meId={me.id} onSend={(t) => actions.chat(t, 'dead')} />
            ) : (
              <Chat messages={view.chat} channel="public" meId={me?.id} onSend={(t) => actions.chat(t, 'public')} disabled={announce ? false : chatDisabled} />
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

function Drips() {
  const drops = [6, 14, 23, 31, 44, 52, 63, 71, 80, 88, 95];
  return (
    <div className="drips" aria-hidden>
      {drops.map((x, i) => (
        <span key={x} style={{ left: `${x}%`, animationDelay: `${(i % 4) * 0.12}s`, ['--h' as string]: `${80 + ((i * 53) % 220)}px`, width: `${3 + (i % 3) * 2}px` }} />
      ))}
    </div>
  );
}
