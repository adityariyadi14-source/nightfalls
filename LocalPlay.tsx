import { useEffect, useMemo, useState } from 'react';
import { buildView } from '../../engine';
import { PassDevice } from '../components/PassDevice';
import { Avatar } from '../components/Avatar';
import { Button, Modal, Panel } from '../components/ui';
import { GameShell } from '../game/GameShell';
import { RoleRevealScreen } from '../game/RoleRevealScreen';
import { NightScreen } from '../game/NightScreen';
import { VotingScreen } from '../game/VotingScreen';
import type { GameActions } from '../game/types';
import { navigate } from '../lib/router';
import {
  abandonLocalGame,
  localNightAction,
  localPassReady,
  localPrivateDone,
  localRematch,
  localTableContinue,
  localVote,
  localJudge,
  localLastWords,
  useLocalGame
} from '../local/localGame';
import { toast } from '../lib/toast';
import { sfx } from '../lib/audio';
import { t } from '../lib/i18n';
import { OpenJudgment, TrialScreen } from '../game/TrialScreen';
import { PlayerGrid } from '../components/PlayerGrid';

export function LocalPlay() {
  const game = useLocalGame();
  const [confirmLeave, setConfirmLeave] = useState(false);
  useEffect(() => {
    if (!game) navigate('/local');
  }, [game]);
  const stage = game?.stage;
  const privateId = stage && stage.kind !== 'table' ? stage.playerId : null;

  const actions = useMemo<GameActions>(
    () => ({
      mode: 'local',
      isHost: true,
      clockOffset: 0,
      ackReveal: () => {},
      nightAction: (kind, target) => {
        if (!privateId) return;
        const err = localNightAction(privateId, kind, target);
        if (err) toast(err, 'error');
      },
      vote: (target) => {
        if (!privateId) return;
        const err = localVote(privateId, target);
        if (err) toast(err, 'error');
      },
      judge: (verdict) => {
        if (!privateId) return;
        const err = localJudge(privateId, verdict);
        if (err) toast(err, 'error');
      },
      lastWords: (text, playerId) => {
        if (!playerId) return;
        const err = localLastWords(playerId, text);
        if (err) toast(err, 'error');
      },
      chat: () => {},
      skipPhase: () => localTableContinue(),
      playAgain: () => localRematch(),
      leave: () => (game?.state.phase === 'gameOver' ? navigate('/menu') : setConfirmLeave(true)),
      done: () => localPrivateDone()
    }),
    [privateId, game?.state.phase]
  );

  if (!game || !stage) return null;
  const state = game.state;
  const view = buildView(state, privateId);

  const leaveModal = (
    <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title={t("Abandon this game?")}>
      <p className="text-sm text-muted">{t("Progress will be lost. The game is saved automatically, so you can also just close the app and resume later.")}</p>
      <div className="mt-4 flex gap-2">
        <Button variant="danger" className="flex-1" onClick={() => { abandonLocalGame(); navigate('/menu'); }}>{t("Abandon")}</Button>
        <Button variant="ghost" className="flex-1" onClick={() => setConfirmLeave(false)}>{t("Keep playing")}</Button>
      </div>
    </Modal>
  );

  let content: React.ReactNode;
  if (stage.kind === 'pass') {
    const p = state.players.find((x) => x.id === stage.playerId)!;
    const what = stage.next === 'reveal' ? t('to see their secret role') : stage.next === 'night' ? t(`Night ${state.day}: to make their move in secret`) : stage.next === 'judge' ? t('to give a secret verdict') : t('to cast a secret vote');
    content = (
      <GameShell view={buildView(state, null)} actions={actions}>
        <PassDevice name={p.name} avatar={p.avatar} photo={p.photo} what={what} onReady={localPassReady} />
      </GameShell>
    );
  } else if (stage.kind === 'reveal') {
    content = (
      <GameShell view={view} actions={actions}>
        <RoleRevealScreen key={stage.playerId} view={view} actions={actions} />
      </GameShell>
    );
  } else if (stage.kind === 'night') {
    content = (
      <GameShell view={view} actions={actions}>
        <NightScreen key={stage.playerId} view={view} actions={actions} />
      </GameShell>
    );
  } else if (stage.kind === 'ballot') {
    content = (
      <GameShell view={view} actions={actions}>
        <VotingScreen key={stage.playerId} view={view} actions={actions} voterId={stage.playerId} />
      </GameShell>
    );
  } else if (stage.kind === 'judge') {
    content = (
      <GameShell view={view} actions={actions}>
        <TrialScreen key={stage.playerId} view={view} actions={actions} voterId={stage.playerId} />
      </GameShell>
    );
  } else if (state.phase === 'judgment') {
    content = (
      <GameShell view={view} actions={actions}>
        <OpenJudgment view={view} onJudge={(id, v) => localJudge(id, v)} onCount={() => localTableContinue()} />
      </GameShell>
    );
  } else if (state.phase === 'voting') {
    // Shared table: open (non-secret) vote
    content = (
      <GameShell view={view} actions={actions}>
        <OpenVote />
      </GameShell>
    );
  } else {
    // Shared table screens: dawn, discussion, verdict, results
    content = <GameShell view={view} actions={actions} />;
  }
  return (
    <>
      {content}
      {leaveModal}
    </>
  );
}

/** Open (non-secret) table vote: tap a voter, then tap who they vote for. */
function OpenVote() {
  const game = useLocalGame()!;
  const state = game.state;
  const view = buildView(state, null);
  const alive = view.players.filter((p) => p.alive);
  const candidates = view.revoteCandidates ? alive.filter((p) => view.revoteCandidates!.includes(p.id)) : alive;
  const [voter, setVoter] = useState<string | null>(null);
  const voteOf = (id: string) => state.votes.find((v) => v.voterId === id);
  const allIn = alive.every((p) => voteOf(p.id));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-8 pt-4">
      <div className="mb-4"><h2 className="title text-2xl font-black">{view.revoteCandidates ? t('Revote') : t('Open vote')} · {t('Day {n}', { n: view.day })}</h2><p className="text-xs text-muted">{t("Tap a voter, then tap who they accuse. Everyone can see the ballot.")}</p></div>
      <Panel title={t("1 · Who is voting?")}>
        <PlayerGrid>
          {alive.map((p) => {
            const v = voteOf(p.id);
            const target = v ? (v.targetId ? view.players.find((x) => x.id === v.targetId)?.name : t('skip')) : null;
            return (
              <button key={p.id} onClick={() => { sfx.select(); setVoter(p.id); }} className={`card-player selectable ${voter === p.id ? 'selected' : ''}`}>
                <Avatar index={p.avatar} photo={p.photo} size={44} />
                <span className="text-xs font-semibold">{p.name}{p.id === view.doubleVoter ? ' · elder' : ''}</span>
                <span className={`chip !text-[10px] ${target ? '!border-accent2/50 !text-accent2' : ''}`}>{target ? `→ ${target}` : t('not voted')}</span>
              </button>
            );
          })}
        </PlayerGrid>
      </Panel>
      <Panel title={voter ? t(`2 · ${view.players.find((p) => p.id === voter)?.name} votes for…`) : t('2 · Pick a voter first')} className="mt-4">
        <PlayerGrid>
          {candidates.map((p) => {
            const n = view.voteTally[p.id] ?? 0;
            return (
              <button key={p.id} disabled={!voter || voter === p.id} onClick={() => { const err = localVote(voter!, p.id); if (err) toast(err, 'error'); else { sfx.vote(); setVoter(null); } }} className={`card-player ${voter && voter !== p.id ? 'selectable' : 'opacity-50'}`}>
                <Avatar index={p.avatar} photo={p.photo} size={44} />
                <span className="text-xs font-semibold">{p.name}</span>
                <span className="font-display text-xl font-black">{n}</span>
              </button>
            );
          })}
        </PlayerGrid>
        <div className="mt-3 flex items-center justify-between">
          <span className="chip">skip · {view.voteTally.skip ?? 0}</span>
          {view.settings.allowSkipVote && <Button size="sm" variant="ghost" disabled={!voter} onClick={() => { localVote(voter!, null); sfx.vote(); setVoter(null); }}>{t("Skip vote")}</Button>}
        </div>
      </Panel>
      <Button size="lg" className="mt-4 w-full" variant={allIn ? 'primary' : 'ghost'} onClick={() => { sfx.gavel(); localTableContinue(); }}>
        {allIn ? t('Count the votes') : t(`Close vote (${state.votes.length}/${alive.length} voted)`)}
      </Button>
    </div>
  );
}
