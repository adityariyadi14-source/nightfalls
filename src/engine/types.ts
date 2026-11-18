export type Team = 'town' | 'mafia' | 'neutral';

export type RoleId =
  | 'citizen'
  | 'detective'
  | 'doctor'
  | 'bodyguard'
  | 'sheriff'
  | 'mafia'
  | 'godfather'
  | 'silencer'
  | 'jester'
  | 'survivor'
  | 'cupid'
  | 'bomb'
  | 'baker';

export type MapId = 'village' | 'house' | 'hospital' | 'villa';

export type Phase =
  | 'lobby'
  | 'roleReveal'
  | 'night'
  | 'dayAnnounce'
  | 'discussion'
  | 'voting'
  | 'defense'
  | 'judgment'
  | 'voteResult'
  | 'gameOver';

export type TieRule = 'noElimination' | 'random' | 'revote';
export type VoteMode = 'plurality' | 'majority';

export type GameEventId =
  | 'blood_moon'
  | 'peaceful_night'
  | 'double_vote'
  | 'anonymous_vote'
  | 'short_fuse'
  | 'fog';

export interface GameSettings {
  /** role -> count. Citizens fill remaining slots automatically. */
  roles: Partial<Record<RoleId, number>>;
  discussionSeconds: number;
  votingSeconds: number;
  nightSeconds: number;
  revealSeconds: number;
  voteMode: VoteMode;
  tieRule: TieRule;
  revealRolesOnDeath: boolean;
  allowSkipVote: boolean;
  doctorSelfHeal: boolean;
  sheriffShots: number;
  sheriffGuilt: boolean;
  survivorVests: number;
  randomEvents: boolean;
  eventChance: number; // 0..1 chance per phase
  firstNightKill: boolean;
  mafiaChat: boolean;
  theme: string;
  /** Hard mode (10+ players): public traits, the Detective gets three clue words instead of a verdict. */
  hardMode: boolean;
  /** Trial: the top-voted player defends, then the town votes guilty or innocent. */
  trial: boolean;
  defenseSeconds: number;
  judgmentSeconds: number;
  /** Dead players may leave one last message. */
  lastWords: boolean;
  /** Where the game takes place; decides crime-scene rooms and murder methods. */
  map: MapId | 'random';
  /** Local mode only: prompt every player at night so roles can't be inferred. */
  promptAllAtNight: boolean;
  /** Local mode only: secret ballot pass-and-play voting vs open voting. */
  secretBallot: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  avatar: number;
  isHost: boolean;
  connected: boolean;
  role: RoleId;
  alive: boolean;
  silenced: boolean;
  /** Bodyguard: id of guarded player (fixed once chosen) */
  guardTarget?: string;
  guardUsed?: boolean;
  shotsLeft?: number;
  vestsLeft?: number;
  diedOn?: { phase: 'night' | 'day'; day: number; cause: DeathCause };
  /** Doctor: last protected player (no repeat) */
  lastTarget?: string;
  /** Hard mode trait id (public) */
  trait?: string;
  /** Profile photo as a small data URL */
  photo?: string;
  /** Cupid's lovers: if one dies the other dies of heartbreak */
  loverId?: string;
  /** Jester: lynched -> wins */
  jesterWon?: boolean;
}

export type DeathCause = 'mafia' | 'sheriff' | 'vote' | 'guilt' | 'bomb' | 'heartbreak';

export interface NightAction {
  actorId: string;
  targetId: string | null; // null = skip
}

export interface NightActions {
  /** mafia member id -> target */
  mafia: Record<string, string | null>;
  detective: Record<string, string | null>;
  doctor: Record<string, string | null>;
  bodyguard: Record<string, string | null>;
  sheriff: Record<string, string | null>;
  silencer: Record<string, string | null>;
  survivor: Record<string, boolean>; // use vest
  cupid: Record<string, [string, string] | null>;
  baker: Record<string, string | null>;
}

/** Crime-scene report. All strings are English phrases, translated on display. */
export interface CrimeScene {
  room: string;
  method: string;
  time: string; // HH:MM
  clue: string;
}

export interface Death {
  playerId: string;
  cause: DeathCause;
  /** who caused it (sheriff, bomb chain) */
  by?: string;
  scene?: CrimeScene;
}

export interface NightReport {
  night: number;
  deaths: Death[];
  saved: boolean; // doctor save happened (publicly announced generically)
  guarded: boolean;
  silenced: string | null;
  /** private results */
  investigations: Record<string, { targetId: string; result: 'suspicious' | 'innocent' }>;
  mafiaTarget: string | null;
  peaceful: boolean;
  /** hard mode: detective id -> three clue words */
  clues: Record<string, string[]>;
  /** players who received the Baker's bread tonight */
  bread: string[];
  /** Cupid bound two lovers tonight */
  lovers: boolean;
}

export interface VoteRecord {
  voterId: string;
  targetId: string | null; // null = skip
}

export interface VoteResult {
  day: number;
  tally: Record<string, number>; // targetId or 'skip' -> votes
  votes: VoteRecord[];
  eliminated: string | null;
  tie: boolean;
  revote: boolean; // this result triggers a revote
  tiedIds: string[];
  jesterWin: boolean;
  /** chained deaths after the elimination: heartbreak, bomb blast */
  extraDeaths: Death[];
  /** set when the elimination went through a trial */
  trial?: TrialResult;
}

export type Verdict = 'guilty' | 'innocent' | 'abstain';

export interface TrialResult {
  accused: string;
  guilty: number;
  innocent: number;
  votes: { voterId: string; verdict: Verdict }[];
  spared: boolean;
}

export interface TrialState {
  accused: string;
  nomination: VoteResult;
  verdicts: Record<string, Verdict>;
}

export interface ChatMessage {
  id: string;
  from: string; // player id or 'system'
  name: string;
  text: string;
  channel: 'public' | 'mafia' | 'dead';
  ts: number;
}

export interface LogEntry {
  id: string;
  ts: number;
  kind: 'info' | 'death' | 'vote' | 'event' | 'phase' | 'win';
  text: string;
  /** optional restricted visibility: list of player ids */
  onlyFor?: string[];
}

export interface WinInfo {
  team: Team | 'draw';
  winners: string[]; // player ids
  reason: string;
}

export interface GameState {
  id: string;
  seed: number;
  settings: GameSettings;
  players: PlayerState[];
  phase: Phase;
  day: number; // increments at each night
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  actions: NightActions;
  votes: VoteRecord[];
  revoteCandidates: string[] | null;
  revoteCount: number;
  nightReports: NightReport[];
  voteResults: VoteResult[];
  log: LogEntry[];
  chat: ChatMessage[];
  activeEvent: GameEventId | null;
  eventHistory: { phase: Phase; day: number; event: GameEventId }[];
  doubleVoter: string | null;
  /** today's bread holders: their vote counts double */
  bread: string[];
  /** the map actually in play (resolved from 'random') */
  map: MapId;
  trial: TrialState | null;
  /** playerId -> last words */
  lastWords: Record<string, string>;
  revealAcks: string[];
  winner: WinInfo | null;
  startedAt: number | null;
  endedAt: number | null;
}

/** What a specific player is allowed to see. */
export interface PublicPlayer {
  id: string;
  name: string;
  avatar: number;
  isHost: boolean;
  connected: boolean;
  alive: boolean;
  silenced: boolean;
  lastWords?: string;
  trait?: string;
  photo?: string;
  role: RoleId | null; // revealed only when allowed
  team: Team | null;
}

export interface NightPrompt {
  kind: 'mafia' | 'detective' | 'doctor' | 'bodyguard' | 'sheriff' | 'silencer' | 'survivor' | 'cupid' | 'baker' | 'none';
  targets: string[];
  canSkip: boolean;
  submitted: boolean;
  current: string | null | boolean | string[];
  /** how many targets must be picked (Cupid picks 2) */
  pick?: number;
  note?: string;
}

export interface NotebookEntry {
  night: number;
  targetId?: string;
  result?: 'suspicious' | 'innocent';
  clues?: string[];
  fog?: boolean;
}

export interface ClientView {
  id: string;
  phase: Phase;
  day: number;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  settings: GameSettings;
  players: PublicPlayer[];
  me: {
    id: string;
    role: RoleId;
    team: Team;
    alive: boolean;
    silenced: boolean;
    allies: string[];
    shotsLeft?: number;
    vestsLeft?: number;
    guardTarget?: string;
    guardUsed?: boolean;
    loverId?: string;
    canLeaveLastWords: boolean;
    notebook: NotebookEntry[];
  } | null;
  trial: { accused: string; voted: number; voters: number; myVerdict: Verdict | null } | null;
  /** players who died this round and may still leave last words */
  recentlyDead: string[];
  nightPrompts: NightPrompt[];
  lastNight: Omit<NightReport, 'investigations' | 'mafiaTarget' | 'clues'> & {
    myInvestigation: { targetId: string; result: 'suspicious' | 'innocent' } | null;
    myClues: string[] | null;
    mafiaTarget: string | null;
  } | null;
  votes: { voterId: string; targetId: string | null }[] | null; // null when anonymous
  myVote: string | null | undefined; // undefined = not voted
  voteTally: Record<string, number>;
  lastVote: VoteResult | null;
  revoteCandidates: string[] | null;
  log: LogEntry[];
  chat: ChatMessage[];
  activeEvent: GameEventId | null;
  doubleVoter: string | null;
  bread: string[];
  map: MapId;
  revealAcks: string[];
  winner: WinInfo | null;
  mafiaTargetVotes: Record<string, string | null> | null;
  eventHistory: { phase: Phase; day: number; event: GameEventId }[];
}
