import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MIN_PLAYERS, validateRoles } from '../../engine';
import { Background } from '../components/Background';
import { PlayerCard, PlayerGrid } from '../components/PlayerGrid';
import { SettingsForm } from '../components/SettingsForm';
import { Button, Modal, Page, Panel, TopBar } from '../components/ui';
import { Chat } from '../components/Chat';
import { GameShell } from '../game/GameShell';
import type { GameActions } from '../game/types';
import { navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { setMusicMood } from '../lib/audio';
import { connect, send, useOnline } from '../online/socket';
import { t } from '../lib/i18n';
import { Icon } from '../components/Icon';

export function OnlineRoom() {
  const online = useOnline();
  const room = online.room;
  useEffect(() => connect(), []);
  useEffect(() => {
    if (online.status === 'online' && !room) {
      const t = setTimeout(() => navigate('/menu'), 1500);
      return () => clearTimeout(t);
    }
  }, [online.status, room]);

  const actions = useMemo<GameActions>(
    () => ({
      mode: 'online',
      isHost: !!room && room.hostId === online.guestId,
      clockOffset: online.clockOffset,
      ackReveal: () => send({ t: 'ackReveal' }),
      nightAction: (kind, target) => send({ t: 'nightAction', kind, target }),
      vote: (target) => send({ t: 'vote', target }),
      judge: (verdict) => send({ t: 'judge', verdict }),
      lastWords: (text) => send({ t: 'lastWords', text }),
      chat: (text, channel) => send({ t: 'chat', text, channel }),
      skipPhase: () => send({ t: 'skipPhase' }),
      playAgain: () => send({ t: 'playAgain' }),
      leave: () => {
        send({ t: 'leaveRoom' });
        navigate('/menu');
      }
    }),
    [room?.hostId, online.guestId, online.clockOffset]
  );

  if (!room) {
    return (
      <Page>
        <Background />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="pulse-ring flex h-16 w-16 items-center justify-center border border-accent text-accent"><Icon name="moon" size={28} /></div>
          <p className="mt-4 text-muted">{online.status === 'online' ? t('Finding your room…') : t('Connecting to the server…')}</p>
          <Button variant="ghost" className="mt-6" onClick={() => navigate('/menu')}>{t("Back to menu")}</Button>
        </div>
      </Page>
    );
  }

  if (room.game && room.status !== 'lobby') {
    return <GameShell view={room.game} actions={actions} conn={online.status} roomCode={room.code} />;
  }
  return <Lobby />;
}

function Lobby() {
  const online = useOnline();
  const room = online.room!;
  const me = online.guestId;
  const isHost = room.hostId === me;
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => setMusicMood('menu'), []);
  const connected = room.players.filter((p) => p.connected).length;
  const err = validateRoles(room.settings, connected);
  const canStart = isHost && connected >= MIN_PLAYERS && !err;
  const inviteLink = `${location.origin}${location.pathname}#join-${room.code}`;

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`, 'success');
    } catch {
      toast(text, 'info', 6000);
    }
  };

  return (
    <Page wide>
      <Background theme={room.settings.theme} />
      <TopBar
        title={<span>{t("Lobby")} <span className="text-muted">·</span> <span className="font-mono tracking-[0.3em] text-accent">{room.code}</span></span>}
        onBack={() => setConfirmLeave(true)}
        right={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => copy(room.code, 'Room code')}>{t("Copy code")}</Button>
            <Button size="sm" variant="ghost" onClick={() => copy(inviteLink, 'Invite link')}>{t("Copy link")}</Button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Panel
            title={t(`Players · ${room.players.length}/${room.maxPlayers}`)}
            right={<span className="chip"><Icon name={room.isPublic ? 'globe' : 'lock'} size={11} /> {room.isPublic ? t('public') : t('private')}</span>}
          >
            <PlayerGrid>
              {room.players.map((p) => (
                <PlayerCard
                  key={p.id}
                  p={{ ...p, alive: true, silenced: false, role: null, team: null }}
                  meId={me}
                  footer={isHost && p.id !== me ? <button className="text-[11px] text-danger hover:underline" onClick={() => send({ t: 'kick', playerId: p.id })}>{t("remove")}</button> : undefined}
                  badge={!p.connected ? <span className="chip !text-[10px]">{t("reconnecting\u2026")}</span> : undefined}
                />
              ))}
              {Array.from({ length: Math.max(0, MIN_PLAYERS - room.players.length) }).map((_, i) => (
                <div key={i} className="card-player border-dashed opacity-50"><div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-line text-xl text-muted">?</div><span className="text-xs text-muted">{t("waiting")}</span></div>
              ))}
            </PlayerGrid>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {err ? <span className="chip !border-amber-400/50 !text-amber-300">{t(err)}</span> : <span className="chip !border-accent2/50 !text-accent2">{t('Ready: {n} players', { n: connected })}</span>}
              {!isHost && <span className="text-sm text-muted">{t("Waiting for the host to start\u2026")}</span>}
            </div>
            {isHost && (
              <motion.div className="mt-4 flex flex-wrap gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button size="lg" disabled={!canStart} onClick={() => send({ t: 'startGame' })}>{t("Start game")}</Button>
                <Button size="lg" variant="ghost" onClick={() => setShowSettings(true)}>{t("Game settings")}</Button>
              </motion.div>
            )}
            {!isHost && <Button className="mt-4" variant="ghost" onClick={() => setShowSettings(true)}>{t("View settings")}</Button>}
          </Panel>
          <Panel title={t("Room summary")}>
            <SummaryChips />
          </Panel>
        </div>
        <Panel title={t("Lobby chat")} className="flex h-[26rem] flex-col lg:h-auto lg:min-h-[26rem]">
          <Chat messages={room.chat} channel="public" meId={me} onSend={(x) => send({ t: 'chat', text: x, channel: 'public' })} />
        </Panel>
      </div>

      <Modal open={showSettings} onClose={() => setShowSettings(false)} title={isHost ? t('Game settings') : t('Game settings (host only)')}>
        <div className="scrollbar-thin max-h-[70vh] overflow-y-auto pr-1">
          <SettingsForm settings={room.settings} playerCount={Math.max(connected, MIN_PLAYERS)} mode="online" readOnly={!isHost} onChange={(p) => send({ t: 'updateSettings', settings: p })} />
        </div>
        <Button className="mt-3 w-full" onClick={() => setShowSettings(false)}>{t("Done")}</Button>
      </Modal>
      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title={t("Leave room?")}>
        <p className="text-sm text-muted">{t("You'll lose your seat in this lobby.")}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => { send({ t: 'leaveRoom' }); navigate('/menu'); }}>{t("Leave")}</Button>
          <Button variant="ghost" className="flex-1" onClick={() => setConfirmLeave(false)}>{t("Stay")}</Button>
        </div>
      </Modal>
    </Page>
  );
}

function SummaryChips() {
  const { room } = useOnline();
  if (!room) return null;
  const s = room.settings;
  const roles = Object.entries(s.roles).filter(([, n]) => n);
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {roles.map(([r, n]) => <span key={r} className="chip">{n}× {r}</span>)}
      <span className="chip">talk {s.discussionSeconds}s</span>
      <span className="chip">vote {s.votingSeconds}s · {s.voteMode}</span>
      <span className="chip">tie: {s.tieRule}</span>
      {s.randomEvents && <span className="chip">events {Math.round(s.eventChance * 100)}%</span>}
      <span className="chip">profile {s.theme}</span>
    </div>
  );
}
