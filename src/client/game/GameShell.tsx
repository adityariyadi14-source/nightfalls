import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ClientView } from '../../engine';
import { MAPS, ROLES } from '../../engine';
import { Background } from '../components/Background';
import { PhaseTransition } from '../components/PhaseTransition';
import { Timer } from '../components/Timer';
import { Modal, Button } from '../components/ui';
import { usePrefs, setPrefs } from '../lib/prefs';
import { setMusicMood, syncMusic, sfx } from '../lib/audio';
import { RoleRevealScreen } from './RoleRevealScreen';
import { NightScreen } from './NightScreen';
import { DayScreen } from './DayScreen';
import { VotingScreen, VoteResultScreen } from './VotingScreen';
import { ResultsScreen } from './ResultsScreen';
import type { GameActions } from './types';
import type { ConnStatus } from '../online/socket';
import { t } from '../lib/i18n';
import { TrialScreen } from './TrialScreen';
import { DeathOverlay, GhostLayer } from '../components/ScreenFx';
import { Icon, RoleIcon } from '../components/Icon';

const PHASE_LABEL: Record<ClientView['phase'], string> = {
  lobby: 'Lobby', roleReveal: 'Role reveal', night: 'Night', dayAnnounce: 'Dawn', discussion: 'Discussion', voting: 'Voting', defense: 'Defense', judgment: 'Judgment', voteResult: 'Verdict', gameOver: 'Game over'
};

/** Common chrome around a game in progress: background, header, phase transitions, phase screen routing. */
export function GameShell({ view, actions, conn, roomCode, children }: { view: ClientView; actions: GameActions; conn?: ConnStatus; roomCode?: string; children?: React.ReactNode }) {
  const prefs = usePrefs();
  const [menu, setMenu] = useState(false);
  const isDay = ['dayAnnounce', 'discussion', 'voting', 'defense', 'judgment', 'voteResult'].includes(view.phase);
  useEffect(() => {
    setMusicMood(view.phase === 'night' || view.phase === 'roleReveal' ? 'night' : view.phase === 'voting' || view.phase === 'defense' || view.phase === 'judgment' ? 'tense' : view.phase === 'gameOver' ? 'menu' : 'day');
  }, [view.phase]);
  // Notify when it's my turn to act
  useEffect(() => {
    if (view.phase === 'night' && view.nightPrompts.some((p) => p.kind !== 'none' && !p.submitted)) sfx.notify();
    if (view.phase === 'voting' && view.me?.alive) sfx.notify();
  }, [view.phase, view.revoteCandidates?.length]);

  const me = view.me;
  const role = me ? ROLES[me.role] : null;
  const wasAlive = useRef<boolean | null>(null);
  const [dying, setDying] = useState<string | null>(null);
  useEffect(() => {
    if (!me || actions.mode !== 'online') return;
    if (wasAlive.current === true && !me.alive && view.phase !== 'gameOver') {
      const nightDeath = view.lastNight?.deaths.find((d) => d.playerId === me.id);
      const scene = nightDeath?.scene;
      setDying(
        nightDeath
          ? scene
            ? t('Killed in {room}. {method}', { room: t(scene.room), method: t(scene.method) })
            : t('You did not survive the night.')
          : t('The town has executed you.')
      );
    }
    wasAlive.current = me.alive;
  }, [me?.alive, view.phase]);

  return (
    <div className="min-h-full">
      <Background theme={view.settings.theme} day={isDay} inGame />
      <PhaseTransition phase={view.phase} day={view.day} />
      <DeathOverlay open={!!dying} cause={dying ?? ''} onDone={() => setDying(null)} />
      <GhostLayer on={actions.mode === 'online' && !!me && !me.alive && view.phase !== 'gameOver' && !dying} />
      <header className="sticky z-30 border-b border-line/30 bg-ink/60 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="title text-xl text-glow">{t("Nightfall")}</span>
            {roomCode && <span className="chip hidden sm:inline-flex">#{roomCode}</span>}
            <span className="chip hidden md:inline-flex"><Icon name={view.map} size={11} /> {t(MAPS[view.map]?.name ?? '')}</span>
            <span className="chip" data-phase={view.phase}><Icon name={isDay ? 'sun' : 'moon'} size={11} /> {t(PHASE_LABEL[view.phase])}{view.day ? ` ${view.day}` : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            {view.phaseEndsAt && actions.mode === 'online' && <Timer endsAt={view.phaseEndsAt} startedAt={view.phaseStartedAt} offset={actions.clockOffset} compact />}
            {role && (
              <span className="hidden items-center gap-1 border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider sm:inline-flex" style={{ borderColor: role.color + '88', color: role.color }}>
                <RoleIcon role={me!.role} size={12} /> {t(role.name)}{me && !me.alive ? ' · dead' : ''}
              </span>
            )}
            {conn && <span className={`h-2.5 w-2.5 ${conn === 'online' ? 'bg-accent2' : conn === 'connecting' ? 'animate-pulse bg-amber-400' : 'bg-danger'}`} title={conn} />}
            <button className="flex h-8 w-8 items-center justify-center border border-line bg-ink/60 hover:border-accent hover:text-accent" onClick={() => { sfx.click(); setMenu(true); }} aria-label={t("Menu")}><Icon name="menu" size={16} /></button>
          </div>
        </div>
      </header>

      {/* Enter-only keyed animation: an exit-wait wrapper can stall when private and shared screens swap. */}
      <motion.div key={view.phase + (view.revoteCandidates ? 'r' : '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          {children ?? (
            <>
              {view.phase === 'roleReveal' && me && <RoleRevealScreen view={view} actions={actions} />}
              {view.phase === 'night' && me && <NightScreen view={view} actions={actions} />}
              {(view.phase === 'dayAnnounce' || view.phase === 'discussion') && <DayScreen view={view} actions={actions} />}
              {view.phase === 'voting' && <VotingScreen view={view} actions={actions} />}
              {(view.phase === 'defense' || view.phase === 'judgment') && <TrialScreen view={view} actions={actions} />}
              {view.phase === 'voteResult' && <VoteResultScreen view={view} actions={actions} />}
              {view.phase === 'gameOver' && <ResultsScreen view={view} actions={actions} />}
            </>
          )}
      </motion.div>

      <Modal open={menu} onClose={() => setMenu(false)} title={t("Menu")}>
        <div className="space-y-3">
          {role && me && (
            <div className="border p-3" style={{ borderColor: role.color + '66' }}>
              <div className="title flex items-center gap-2 text-2xl" style={{ color: role.color }}><RoleIcon role={me.role} size={20} /> {t(role.name)}</div>
              <div className="mt-2 text-[12px] leading-relaxed text-muted">{t(role.description)}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => { setPrefs({ sfx: !prefs.sfx }); }}><Icon name="sound" size={14} /> {prefs.sfx ? t('SFX on') : t('SFX off')}</Button>
            <Button variant="ghost" onClick={() => { setPrefs({ music: !prefs.music }); syncMusic(); }}><Icon name="music" size={14} /> {prefs.music ? t('Music on') : t('Music off')}</Button>
          </div>
          <Button variant="danger" className="w-full" onClick={() => { setMenu(false); actions.leave(); }}>{actions.mode === 'online' ? t('Leave game') : t('Abandon game')}</Button>
          <Button variant="ghost" className="w-full" onClick={() => setMenu(false)}>{t("Close")}</Button>
        </div>
      </Modal>
    </div>
  );
}
