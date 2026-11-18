import type { WebSocket } from 'ws';
import {
  ackReveal,
  addSystemChat,
  advance,
  buildView,
  castVote,
  createGame,
  defaultSettings,
  MAX_ONLINE_PLAYERS,
  MIN_PLAYERS,
  phaseComplete,
  randomId,
  randomSeed,
  removePlayer,
  submitNightAction,
  teamOf,
  timerExpired,
  validateRoles,
  isMafia,
  castJudgment,
  submitLastWords
} from '../src/engine';
import type { Verdict } from '../src/engine';
import type { GameSettings, GameState } from '../src/engine';
import type { NightActionKind } from '../src/engine/game';
import type { LobbyPlayerInfo, MatchRecord, RoomStatus, RoomView, S2C } from '../src/shared/protocol';

export interface Client {
  ws: WebSocket;
  guestId: string;
  name: string;
  avatar: number;
  photo?: string;
  roomCode: string | null;
  alive: boolean; // ping/pong liveness
}

interface Seat {
  id: string;
  name: string;
  avatar: number;
  photo?: string;
  connected: boolean;
  socket: WebSocket | null;
  disconnectedAt: number | null;
}

const LOBBY_DISCONNECT_GRACE = 60_000;

const ALLOWED_SETTING_KEYS: (keyof GameSettings)[] = [
  'roles', 'discussionSeconds', 'votingSeconds', 'nightSeconds', 'revealSeconds', 'voteMode', 'tieRule',
  'revealRolesOnDeath', 'allowSkipVote', 'doctorSelfHeal', 'sheriffShots', 'sheriffGuilt', 'survivorVests',
  'randomEvents', 'eventChance', 'firstNightKill', 'mafiaChat', 'theme', 'map',
  'trial', 'defenseSeconds', 'judgmentSeconds', 'lastWords', 'hardMode'
];

const clampInt = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
};

/** Sanitises a partial settings object coming from a client. */
export function sanitizeSettings(base: GameSettings, patch: Partial<GameSettings>): GameSettings {
  const out: GameSettings = { ...base, roles: { ...base.roles } };
  for (const k of ALLOWED_SETTING_KEYS) {
    if (!(k in patch)) continue;
    const v = (patch as Record<string, unknown>)[k];
    switch (k) {
      case 'roles': {
        if (typeof v !== 'object' || !v) break;
        const roles: GameSettings['roles'] = {};
        for (const [r, n] of Object.entries(v as Record<string, unknown>)) {
          if (['citizen', 'detective', 'doctor', 'bodyguard', 'sheriff', 'mafia', 'godfather', 'silencer', 'jester', 'survivor', 'cupid', 'bomb', 'baker'].includes(r)) {
            const c = clampInt(n, 0, 10, 0);
            if (c > 0) (roles as Record<string, number>)[r] = c;
          }
        }
        out.roles = roles;
        break;
      }
      case 'discussionSeconds': out.discussionSeconds = clampInt(v, 20, 600, base.discussionSeconds); break;
      case 'votingSeconds': out.votingSeconds = clampInt(v, 15, 300, base.votingSeconds); break;
      case 'nightSeconds': out.nightSeconds = clampInt(v, 15, 180, base.nightSeconds); break;
      case 'revealSeconds': out.revealSeconds = clampInt(v, 5, 60, base.revealSeconds); break;
      case 'defenseSeconds': out.defenseSeconds = clampInt(v, 10, 120, base.defenseSeconds); break;
      case 'judgmentSeconds': out.judgmentSeconds = clampInt(v, 10, 60, base.judgmentSeconds); break;
      case 'sheriffShots': out.sheriffShots = clampInt(v, 1, 5, base.sheriffShots); break;
      case 'survivorVests': out.survivorVests = clampInt(v, 0, 5, base.survivorVests); break;
      case 'eventChance': out.eventChance = Math.min(1, Math.max(0, Number(v) || 0)); break;
      case 'voteMode': if (v === 'plurality' || v === 'majority') out.voteMode = v; break;
      case 'tieRule': if (v === 'noElimination' || v === 'random' || v === 'revote') out.tieRule = v; break;
      case 'theme': if (typeof v === 'string' && v.length < 32) out.theme = v; break;
      case 'map': if (v === 'random' || v === 'village' || v === 'house' || v === 'hospital' || v === 'villa') out.map = v; break;
      default:
        (out as unknown as Record<string, unknown>)[k] = Boolean(v);
    }
  }
  return out;
}

export class Room {
  code: string;
  isPublic: boolean;
  hostId: string;
  status: RoomStatus = 'lobby';
  seats: Seat[] = [];
  settings: GameSettings;
  game: GameState | null = null;
  createdAt = Date.now();
  lastActivity = Date.now();
  private dirty = false;

  constructor(code: string, isPublic: boolean, hostId: string, settings?: Partial<GameSettings>, private onMatchEnd?: (m: MatchRecord) => void) {
    this.code = code;
    this.isPublic = isPublic;
    this.hostId = hostId;
    this.settings = sanitizeSettings(defaultSettings(6), settings ?? {});
  }

  // ------------------------------------------------------------------ seats
  seat(id: string) {
    return this.seats.find((s) => s.id === id);
  }

  get connectedCount() {
    return this.seats.filter((s) => s.connected).length;
  }

  addPlayer(c: Client): string | null {
    if (this.seat(c.guestId)) return this.reconnect(c);
    if (this.status !== 'lobby') return 'This game is already in progress.';
    if (this.seats.length >= MAX_ONLINE_PLAYERS) return 'This room is full.';
    this.seats.push({ id: c.guestId, name: c.name, avatar: c.avatar, photo: c.photo, connected: true, socket: c.ws, disconnectedAt: null });
    this.touch();
    this.systemToast(`${c.name} joined the room.`, 'info', c.guestId);
    return null;
  }

  reconnect(c: Client): string | null {
    const s = this.seat(c.guestId);
    if (!s) return 'Not in this room.';
    if (s.socket && s.socket !== c.ws) {
      try { s.socket.close(4000, 'Replaced by a new connection'); } catch { /* noop */ }
    }
    s.socket = c.ws;
    s.connected = true;
    s.disconnectedAt = null;
    s.name = c.name || s.name;
    if (this.status !== 'playing') s.photo = c.photo;
    const gp = this.game?.players.find((p) => p.id === c.guestId);
    if (gp) gp.connected = true;
    this.touch();
    return null;
  }

  markDisconnected(guestId: string) {
    const s = this.seat(guestId);
    if (!s) return;
    s.connected = false;
    s.socket = null;
    s.disconnectedAt = Date.now();
    const gp = this.game?.players.find((p) => p.id === guestId);
    if (gp) gp.connected = false;
    this.touch();
  }

  removeSeat(guestId: string, reason: 'left' | 'kicked' | 'timeout') {
    const s = this.seat(guestId);
    if (!s) return;
    this.seats = this.seats.filter((x) => x.id !== guestId);
    if (this.game && this.status === 'playing') {
      removePlayer(this.game, guestId, Date.now());
      if (this.game.phase === 'gameOver') this.finishGame();
    }
    if (this.hostId === guestId && this.seats.length) {
      this.hostId = (this.seats.find((x) => x.connected) ?? this.seats[0]).id;
      if (this.game) this.game.players.forEach((p) => (p.isHost = p.id === this.hostId));
    }
    this.systemToast(`${s.name} ${reason === 'kicked' ? 'was removed from' : 'left'} the room.`, 'warn');
    this.touch();
  }

  // ---------------------------------------------------------------- actions
  updateSettings(by: string, patch: Partial<GameSettings>): string | null {
    if (by !== this.hostId) return 'Only the host can change settings.';
    if (this.status === 'playing') return 'Cannot change settings mid-game.';
    this.settings = sanitizeSettings(this.settings, patch);
    this.touch();
    return null;
  }

  updateProfile(id: string, name: string, avatar: number, photo?: string) {
    const s = this.seat(id);
    if (!s || this.status === 'playing') return;
    s.name = name;
    s.avatar = avatar;
    s.photo = photo;
    this.touch();
  }

  kick(by: string, target: string): string | null {
    if (by !== this.hostId) return 'Only the host can remove players.';
    if (target === by) return 'You cannot remove yourself.';
    const s = this.seat(target);
    if (!s) return 'Player not found.';
    const sock = s.socket;
    this.removeSeat(target, 'kicked');
    if (sock) send(sock, { t: 'left' });
    return null;
  }

  startGame(by: string): string | null {
    if (by !== this.hostId) return 'Only the host can start the game.';
    if (this.status === 'playing') return 'Game already running.';
    const players = this.seats.filter((s) => s.connected);
    if (players.length < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} connected players.`;
    const err = validateRoles(this.settings, players.length);
    if (err) return err;
    // Drop seats that are disconnected so they don't get roles.
    this.seats = players;
    const now = Date.now();
    this.game = createGame(
      players.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar, photo: s.photo, isHost: s.id === this.hostId, connected: s.connected })),
      this.settings,
      randomSeed(),
      now
    );
    this.status = 'playing';
    this.touch();
    return null;
  }

  playAgain(by: string): string | null {
    if (by !== this.hostId) return 'Only the host can restart.';
    if (this.status !== 'ended') return 'Game is still running.';
    this.game = null;
    this.status = 'lobby';
    this.lobbyChat = [];
    this.seats = this.seats.filter((s) => s.connected);
    this.touch();
    return null;
  }

  ackReveal(id: string) {
    if (!this.game) return;
    if (ackReveal(this.game, id)) this.touch();
  }

  nightAction(id: string, kind: NightActionKind, target: string | null | boolean | string[]): string | null {
    if (!this.game) return 'No game.';
    const err = submitNightAction(this.game, id, kind, target);
    if (!err) this.touch();
    return err;
  }

  vote(id: string, target: string | null): string | null {
    if (!this.game) return 'No game.';
    const err = castVote(this.game, id, target);
    if (!err) this.touch();
    return err;
  }

  judge(id: string, verdict: Verdict): string | null {
    if (!this.game) return 'No game.';
    const err = castJudgment(this.game, id, verdict);
    if (!err) this.touch();
    return err;
  }

  lastWords(id: string, text: string): string | null {
    if (!this.game) return 'No game.';
    const err = submitLastWords(this.game, id, text, Date.now());
    if (!err) this.touch();
    return err;
  }

  chat(id: string, text: string, channel: 'public' | 'mafia' | 'dead'): string | null {
    const s = this.seat(id);
    if (!s) return 'Not in room.';
    const clean = String(text ?? '').trim().slice(0, 280);
    if (!clean) return null;
    const g = this.game;
    if (!g || this.status !== 'playing') {
      // lobby/ended chat is public
      if (g) g.chat.push({ id: randomId(8), from: id, name: s.name, text: clean, channel: 'public', ts: Date.now() });
      else {
        this.lobbyChat.push({ id: randomId(8), from: id, name: s.name, text: clean, channel: 'public', ts: Date.now() });
        if (this.lobbyChat.length > 100) this.lobbyChat = this.lobbyChat.slice(-100);
      }
      this.touch();
      return null;
    }
    const p = g.players.find((x) => x.id === id);
    if (!p) return 'Not in game.';
    if (channel === 'public') {
      if (!p.alive) return 'The dead cannot speak to the living.';
      if (p.silenced) return 'You have been silenced today.';
      if (!['discussion', 'voting', 'dayAnnounce', 'voteResult', 'defense', 'judgment'].includes(g.phase)) return 'You can only speak during the day.';
      if (g.phase === 'defense' && g.trial && g.trial.accused !== id) return 'Only the accused may speak during the defense.';
    } else if (channel === 'mafia') {
      if (!isMafia(p.role)) return 'Not allowed.';
      if (!g.settings.mafiaChat) return 'Mafia chat is disabled.';
      if (g.phase !== 'night' && g.phase !== 'roleReveal') return 'Mafia can only whisper at night.';
    } else if (channel === 'dead') {
      if (p.alive) return 'Not allowed.';
    }
    g.chat.push({ id: randomId(8), from: id, name: s.name, text: clean, channel, ts: Date.now() });
    if (g.chat.length > 400) g.chat = g.chat.slice(-400);
    this.touch();
    return null;
  }

  lobbyChat: GameState['chat'] = [];

  skipPhase(by: string): string | null {
    const g = this.game;
    if (!g) return 'No game.';
    if (by !== this.hostId) return 'Only the host can skip.';
    if (!['roleReveal', 'dayAnnounce', 'discussion', 'defense', 'voteResult'].includes(g.phase)) return 'This phase cannot be skipped.';
    this.step();
    return null;
  }

  // ------------------------------------------------------------------- tick
  /** Called frequently; applies timers and auto-advances. Returns true if state changed. */
  tick(now: number): boolean {
    // Lobby cleanup of long-disconnected seats
    if (this.status !== 'playing') {
      for (const s of [...this.seats]) {
        if (!s.connected && s.disconnectedAt && now - s.disconnectedAt > LOBBY_DISCONNECT_GRACE) this.removeSeat(s.id, 'timeout');
      }
    }
    const g = this.game;
    if (g && this.status === 'playing') {
      if (g.phase === 'gameOver') {
        this.finishGame();
      } else if (phaseComplete(g) || timerExpired(g, now)) {
        this.step();
      }
    }
    const d = this.dirty;
    this.dirty = false;
    return d;
  }

  private step() {
    const g = this.game!;
    const now = Date.now();
    const before = g.phase;
    advance(g, now);
    if (g.phase === 'night' && before !== 'night' && g.settings.mafiaChat) {
      addSystemChat(g, now, `Night ${g.day}. Agree on a target.`, 'mafia');
    }
    if (g.phase === 'gameOver') this.finishGame();
    this.touch();
  }

  private finishGame() {
    const g = this.game;
    if (!g || this.status !== 'playing') return;
    this.status = 'ended';
    const rec: MatchRecord = {
      id: g.id,
      mode: 'online',
      startedAt: g.startedAt ?? g.phaseStartedAt,
      endedAt: g.endedAt ?? Date.now(),
      days: g.day,
      winner: g.winner?.team ?? 'draw',
      roomCode: this.code,
      players: g.players.map((p) => ({ id: p.id, name: p.name, role: p.role, alive: p.alive, won: !!g.winner?.winners.includes(p.id) }))
    };
    this.onMatchEnd?.(rec);
    this.touch();
  }

  // ------------------------------------------------------------- broadcast
  touch() {
    this.dirty = true;
    this.lastActivity = Date.now();
  }

  view(forId: string): RoomView {
    const players: LobbyPlayerInfo[] = this.seats.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar, photo: s.photo, isHost: s.id === this.hostId, connected: s.connected }));
    const game = this.game ? buildView(this.game, forId) : null;
    return {
      chat: this.lobbyChat,
      code: this.code,
      isPublic: this.isPublic,
      hostId: this.hostId,
      status: this.status,
      players,
      settings: this.settings,
      game,
      serverNow: Date.now(),
      maxPlayers: MAX_ONLINE_PLAYERS
    };
  }

  broadcast() {
    for (const s of this.seats) {
      if (s.socket && s.connected) send(s.socket, { t: 'room', room: this.view(s.id) });
    }
  }

  systemToast(text: string, kind: 'info' | 'warn' | 'success', except?: string) {
    for (const s of this.seats) {
      if (s.socket && s.connected && s.id !== except) send(s.socket, { t: 'toast', text, kind });
    }
  }

  get isEmpty() {
    return this.seats.length === 0 || this.seats.every((s) => !s.connected && s.disconnectedAt && Date.now() - s.disconnectedAt > 10 * 60_000);
  }

  get publicInfo() {
    const host = this.seat(this.hostId);
    return { code: this.code, hostName: host?.name ?? 'Host', players: this.seats.length, maxPlayers: MAX_ONLINE_PLAYERS, theme: this.settings.theme };
  }
}

export function send(ws: WebSocket, msg: S2C) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

export { teamOf };
