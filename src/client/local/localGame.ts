import { useSyncExternalStore } from 'react';
import {
  advance,
  beginDiscussion,
  beginNight,
  beginVoting,
  buildView,
  castVote,
  createGame,
  getNightPrompts,
  randomId,
  randomSeed,
  resolveNight,
  resolveVotes,
  submitNightAction,
  alivePlayers,
  checkWin,
  endGame,
  beginJudgment,
  castJudgment,
  judgmentVoters,
  resolveJudgment,
  submitLastWords
} from '../../engine';
import type { Verdict } from '../../engine';
import type { ClientView, GameSettings, GameState } from '../../engine';
import type { NightActionKind } from '../../engine/game';
import { saveLocalMatch } from '../lib/stats';
import { safeStorage } from '../lib/env';

export type LocalStage =
  | { kind: 'pass'; playerId: string; next: 'reveal' | 'night' | 'ballot' | 'judge' }
  | { kind: 'reveal'; playerId: string }
  | { kind: 'night'; playerId: string }
  | { kind: 'ballot'; playerId: string }
  | { kind: 'judge'; playerId: string }
  | { kind: 'table' };

export interface LocalGame {
  state: GameState;
  stage: LocalStage;
  queue: string[];
  version: number;
}

const KEY = 'nightfall.local.game.v1';
let game: LocalGame | null = load();
const listeners = new Set<() => void>();

function load(): LocalGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalGame) : null;
  } catch {
    return null;
  }
}

function commit() {
  if (game) {
    game = { ...game, version: game.version + 1 };
    try { localStorage.setItem(KEY, JSON.stringify(game)); } catch { /* ignore */ }
  } else {
    safeStorage.remove(KEY);
  }
  listeners.forEach((l) => l());
}

export function useLocalGame() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => game
  );
}

export const hasLocalGame = () => !!game && game.state.phase !== 'gameOver';

export interface LocalPlayerInput {
  name: string;
  avatar: number;
  photo?: string;
}

export function startLocalGame(players: LocalPlayerInput[], settings: GameSettings) {
  const now = Date.now();
  const lobby = players.map((p, i) => ({ id: `l${i}_${randomId(4)}`, name: p.name, avatar: p.avatar, photo: p.photo, isHost: i === 0 }));
  const state = createGame(lobby, settings, randomSeed(), now, randomId());
  const queue = lobby.map((p) => p.id);
  game = { state, stage: { kind: 'pass', playerId: queue[0], next: 'reveal' }, queue: queue.slice(1), version: 0 };
  commit();
}

export function abandonLocalGame() {
  game = null;
  commit();
}

function nightQueue(state: GameState): string[] {
  const alive = alivePlayers(state);
  if (state.settings.promptAllAtNight) return alive.map((p) => p.id);
  return alive.filter((p) => getNightPrompts(state, p.id).some((pr) => pr.kind !== 'none')).map((p) => p.id);
}

function enterNight() {
  if (!game) return;
  beginNight(game.state, Date.now());
  const q = nightQueue(game.state);
  if (q.length === 0) {
    resolveNight(game.state, Date.now());
    game.stage = { kind: 'table' };
    checkEnd();
  } else {
    game.stage = { kind: 'pass', playerId: q[0], next: 'night' };
    game.queue = q.slice(1);
  }
}

function enterVoting(revote: string[] | null = null) {
  if (!game) return;
  if (!revote) beginVoting(game.state, Date.now());
  if (game.state.settings.secretBallot) {
    const q = alivePlayers(game.state).map((p) => p.id);
    game.stage = { kind: 'pass', playerId: q[0], next: 'ballot' };
    game.queue = q.slice(1);
  } else {
    game.stage = { kind: 'table' };
    game.queue = [];
  }
}

function enterJudgment() {
  if (!game) return;
  beginJudgment(game.state, Date.now());
  if (game.state.settings.secretBallot) {
    const q = judgmentVoters(game.state).map((p) => p.id);
    game.stage = { kind: 'pass', playerId: q[0], next: 'judge' };
    game.queue = q.slice(1);
  } else {
    game.stage = { kind: 'table' };
    game.queue = [];
  }
}

export function localJudge(voterId: string, verdict: Verdict) {
  if (!game) return 'No game';
  const err = castJudgment(game.state, voterId, verdict);
  commit();
  return err;
}

export function localLastWords(playerId: string, text: string) {
  if (!game) return 'No game';
  const err = submitLastWords(game.state, playerId, text, Date.now());
  commit();
  return err;
}

function checkEnd() {
  if (!game) return;
  const s = game.state;
  if (s.phase === 'gameOver' && s.winner) {
    saveLocalMatch({
      id: s.id,
      mode: 'local',
      startedAt: s.startedAt ?? 0,
      endedAt: s.endedAt ?? Date.now(),
      days: s.day,
      winner: s.winner.team,
      players: s.players.map((p) => ({ id: p.id, name: p.name, role: p.role, alive: p.alive, won: s.winner!.winners.includes(p.id) }))
    });
  }
}

/** The player holding the device tapped "I'm ready" on the pass screen. */
export function localPassReady() {
  if (!game || game.stage.kind !== 'pass') return;
  game.stage = { kind: game.stage.next, playerId: game.stage.playerId };
  commit();
}

/** The current private screen (reveal / night / ballot) is finished. */
export function localPrivateDone() {
  if (!game) return;
  const stage = game.stage;
  if (stage.kind !== 'reveal' && stage.kind !== 'night' && stage.kind !== 'ballot' && stage.kind !== 'judge') return;
  const next = game.queue[0];
  if (next) {
    game.stage = { kind: 'pass', playerId: next, next: stage.kind };
    game.queue = game.queue.slice(1);
    commit();
    return;
  }
  // Queue finished
  if (stage.kind === 'reveal') {
    enterNight();
  } else if (stage.kind === 'night') {
    resolveNight(game.state, Date.now());
    game.stage = { kind: 'table' };
    checkEnd();
  } else if (stage.kind === 'judge') {
    resolveJudgment(game.state, Date.now());
    game.stage = { kind: 'table' };
    checkEnd();
  } else {
    const res = resolveVotes(game.state, Date.now());
    if (res.revote && game.state.phase === 'voting') enterVoting(game.state.revoteCandidates);
    else {
      game.stage = { kind: 'table' };
      checkEnd();
    }
  }
  commit();
}

/** Continue button on shared (table) screens. */
export function localTableContinue() {
  if (!game || game.stage.kind !== 'table') return;
  const s = game.state;
  const now = Date.now();
  switch (s.phase) {
    case 'dayAnnounce':
      beginDiscussion(s, now);
      break;
    case 'discussion':
      enterVoting();
      break;
    case 'voting': {
      // open vote finished
      const res = resolveVotes(s, now);
      if (res.revote && s.phase === 'voting') enterVoting(s.revoteCandidates);
      else checkEnd();
      break;
    }
    case 'defense':
      enterJudgment();
      break;
    case 'judgment':
      // open table judgment finished
      resolveJudgment(s, now);
      checkEnd();
      break;
    case 'voteResult': {
      const win = checkWin(s);
      if (win) {
        endGame(s, win, now);
        checkEnd();
      } else enterNight();
      break;
    }
    case 'roleReveal':
      advance(s, now);
      break;
    default:
      break;
  }
  commit();
}

export function localNightAction(playerId: string, kind: NightActionKind, target: string | null | boolean | string[]) {
  if (!game) return 'No game';
  const err = submitNightAction(game.state, playerId, kind, target);
  commit();
  return err;
}

export function localVote(voterId: string, target: string | null) {
  if (!game) return 'No game';
  const err = castVote(game.state, voterId, target);
  commit();
  return err;
}

export function localSkipPhase() {
  localTableContinue();
}

export function localRematch() {
  if (!game) return;
  const s = game.state;
  const players = s.players.map((p) => ({ name: p.name, avatar: p.avatar, photo: p.photo }));
  startLocalGame(players, s.settings);
}

export function localView(playerId: string | null): ClientView | null {
  return game ? buildView(game.state, playerId) : null;
}
