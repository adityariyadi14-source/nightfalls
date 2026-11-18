import type { ChatMessage, ClientView, GameSettings, RoleId, Team } from '../engine/types';
import type { NightActionKind } from '../engine/game';

export interface LobbyPlayerInfo {
  id: string;
  name: string;
  avatar: number;
  isHost: boolean;
  connected: boolean;
  photo?: string;
}

export type RoomStatus = 'lobby' | 'playing' | 'ended';

export interface RoomView {
  code: string;
  isPublic: boolean;
  hostId: string;
  status: RoomStatus;
  players: LobbyPlayerInfo[];
  settings: GameSettings;
  game: ClientView | null;
  /** Lobby chat (before a game exists). */
  chat: ChatMessage[];
  serverNow: number;
  maxPlayers: number;
}

export interface PublicRoomInfo {
  code: string;
  hostName: string;
  players: number;
  maxPlayers: number;
  theme: string;
}

export interface MatchPlayerRecord {
  id: string;
  name: string;
  role: RoleId;
  alive: boolean;
  won: boolean;
}

export interface MatchRecord {
  id: string;
  mode: 'online' | 'local';
  startedAt: number;
  endedAt: number;
  days: number;
  winner: Team | 'draw';
  players: MatchPlayerRecord[];
  roomCode?: string;
}

export type C2S =
  | { t: 'hello'; guestId: string | null; secret: string | null; name: string; avatar: number; photo?: string | null }
  | { t: 'createRoom'; isPublic: boolean; settings?: Partial<GameSettings> }
  | { t: 'joinRoom'; code: string }
  | { t: 'quickJoin' }
  | { t: 'listRooms' }
  | { t: 'leaveRoom' }
  | { t: 'updateSettings'; settings: Partial<GameSettings> }
  | { t: 'updateProfile'; name: string; avatar: number; photo?: string | null }
  | { t: 'kick'; playerId: string }
  | { t: 'startGame' }
  | { t: 'ackReveal' }
  | { t: 'nightAction'; kind: NightActionKind; target: string | null | boolean | string[] }
  | { t: 'vote'; target: string | null }
  | { t: 'judge'; verdict: 'guilty' | 'innocent' | 'abstain' }
  | { t: 'lastWords'; text: string }
  | { t: 'chat'; text: string; channel: 'public' | 'mafia' | 'dead' }
  | { t: 'skipPhase' }
  | { t: 'playAgain' }
  | { t: 'getHistory' }
  | { t: 'register'; username: string; password: string }
  | { t: 'login'; username: string; password: string }
  | { t: 'logout' }
  | { t: 'ping'; ts: number };

export type S2C =
  | { t: 'welcome'; guestId: string; secret: string; roomCode: string | null; username: string | null }
  | { t: 'account'; username: string | null; guestId: string; secret: string; name?: string; avatar?: number }
  | { t: 'room'; room: RoomView }
  | { t: 'left' }
  | { t: 'error'; message: string }
  | { t: 'rooms'; rooms: PublicRoomInfo[] }
  | { t: 'history'; matches: MatchRecord[] }
  | { t: 'toast'; text: string; kind: 'info' | 'warn' | 'success' }
  | { t: 'pong'; ts: number; now: number };
