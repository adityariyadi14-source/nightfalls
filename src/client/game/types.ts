import type { NightActionKind } from '../../engine/game';

/** Everything a phase screen can do, implemented by both the online adapter and the local adapter. */
export interface GameActions {
  mode: 'online' | 'local';
  isHost: boolean;
  clockOffset: number;
  ackReveal(): void;
  nightAction(kind: NightActionKind, target: string | null | boolean | string[]): void;
  vote(target: string | null): void;
  judge(verdict: 'guilty' | 'innocent' | 'abstain'): void;
  /** Local mode passes the dead player's id; online uses the signed-in player. */
  lastWords(text: string, playerId?: string): void;
  chat(text: string, channel: 'public' | 'mafia' | 'dead'): void;
  skipPhase(): void;
  playAgain(): void;
  leave(): void;
  /** Local pass-and-play: finish the current private screen. */
  done?(): void;
}
