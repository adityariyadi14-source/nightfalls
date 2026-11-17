import type {
  ChatMessage,
  CrimeScene,
  Death,
  DeathCause,
  MapId,
  GameEventId,
  GameSettings,
  GameState,
  LogEntry,
  NightPrompt,
  NightReport,
  Phase,
  PlayerState,
  RoleId,
  Team,
  VoteResult,
  Verdict,
  WinInfo
} from './types';
import { ROLES, isMafia, suggestRoles, teamOf } from './roles';
import { DAY_EVENTS, EVENTS, NIGHT_EVENTS } from './events';
import { createRng, randomId } from './rng';
import { CAUSE_METHOD, CLUES, MAPS, MAP_IDS } from './maps';
import { HARD_MODE_MIN_PLAYERS, TRAITS, traitById } from './traits';

export const MIN_PLAYERS = 4;
export const MAX_ONLINE_PLAYERS = 15;
export const MAX_LOCAL_PLAYERS = 36;

export const ANNOUNCE_SECONDS = 12;
export const VOTE_RESULT_SECONDS = 10;

export function defaultSettings(playerCount = 6): GameSettings {
  return {
    roles: suggestRoles(playerCount),
    discussionSeconds: 120,
    votingSeconds: 45,
    nightSeconds: 40,
    revealSeconds: 20,
    voteMode: 'plurality',
    tieRule: 'noElimination',
    revealRolesOnDeath: true,
    allowSkipVote: true,
    doctorSelfHeal: true,
    sheriffShots: 1,
    sheriffGuilt: true,
    survivorVests: 2,
    randomEvents: true,
    eventChance: 0.3,
    firstNightKill: true,
    mafiaChat: true,
    theme: 'blood',
    map: 'random',
    hardMode: false,
    trial: true,
    defenseSeconds: 30,
    judgmentSeconds: 20,
    lastWords: true,
    promptAllAtNight: true,
    secretBallot: true
  };
}

/** Returns an error message if the role configuration can't be played by `count` players. */
export function validateRoles(settings: GameSettings, count: number): string | null {
  if (count < MIN_PLAYERS) return `At least ${MIN_PLAYERS} players are required.`;
  if (settings.hardMode && count < HARD_MODE_MIN_PLAYERS) return `Hard mode needs at least ${HARD_MODE_MIN_PLAYERS} players.`;
  const roles = settings.roles;
  const total = Object.values(roles).reduce((a, b) => a + (b ?? 0), 0);
  if (total > count) return `Too many special roles (${total}) for ${count} players.`;
  const mafiaCount = (roles.mafia ?? 0) + (roles.godfather ?? 0) + (roles.silencer ?? 0);
  if (mafiaCount < 1) return 'There must be at least one Mafia-team role.';
  if ((roles.godfather ?? 0) > 1) return 'Only one Godfather is allowed.';
  const nonMafia = count - mafiaCount;
  if (mafiaCount >= nonMafia) return 'Mafia must be outnumbered at the start of the game.';
  return null;
}

/** Expands the role config into a concrete, shuffled list of roles for `count` players. */
export function buildRoleList(settings: GameSettings, count: number, seed: number): RoleId[] {
  const list: RoleId[] = [];
  (Object.keys(settings.roles) as RoleId[]).forEach((r) => {
    for (let i = 0; i < (settings.roles[r] ?? 0); i++) list.push(r);
  });
  while (list.length < count) list.push('citizen');
  return createRng(seed ^ 0x9e3779b9).shuffle(list);
}

export interface LobbyPlayer {
  id: string;
  name: string;
  avatar: number;
  isHost: boolean;
  connected?: boolean;
  photo?: string;
}

export function createGame(
  lobby: LobbyPlayer[],
  settings: GameSettings,
  seed: number,
  now: number,
  id = randomId()
): GameState {
  const err = validateRoles(settings, lobby.length);
  if (err) throw new Error(err);
  const roles = buildRoleList(settings, lobby.length, seed);
  const map: MapId = settings.map && settings.map !== 'random' && MAPS[settings.map] ? settings.map : createRng(seed ^ 0x51ed).pick(MAP_IDS);
  const players: PlayerState[] = lobby.map((p, i) => {
    const role = roles[i];
    const ps: PlayerState = {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      connected: p.connected ?? true,
      photo: p.photo,
      role,
      alive: true,
      silenced: false
    };
    if (role === 'sheriff') ps.shotsLeft = settings.sheriffShots;
    if (role === 'survivor') ps.vestsLeft = settings.survivorVests;
    return ps;
  });
  const traits = createRng(seed ^ 0x7a17).shuffle(TRAITS);
  if (settings.hardMode) players.forEach((p, i) => (p.trait = traits[i % traits.length].id));
  const state: GameState = {
    id,
    seed,
    settings: { ...settings, roles: { ...settings.roles } },
    players,
    phase: 'roleReveal',
    day: 0,
    phaseStartedAt: now,
    phaseEndsAt: now + settings.revealSeconds * 1000,
    actions: emptyActions(),
    votes: [],
    revoteCandidates: null,
    revoteCount: 0,
    nightReports: [],
    voteResults: [],
    log: [],
    chat: [],
    activeEvent: null,
    eventHistory: [],
    doubleVoter: null,
    bread: [],
    map,
    trial: null,
    lastWords: {},
    revealAcks: [],
    winner: null,
    startedAt: now,
    endedAt: null
  };
  addLog(state, now, 'phase', 'The game has begun. Roles have been dealt in secret.');
  return state;
}

function emptyActions() {
  return { mafia: {}, detective: {}, doctor: {}, bodyguard: {}, sheriff: {}, silencer: {}, survivor: {}, cupid: {}, baker: {} };
}

// ---------------------------------------------------------------------------
// Last words
// ---------------------------------------------------------------------------

export const LAST_WORDS_MAX = 140;

/** A player who died this night/day may leave one last message, once. */
export function canLeaveLastWords(state: GameState, playerId: string) {
  const p = getPlayer(state, playerId);
  if (!p || p.alive || !p.diedOn || !state.settings.lastWords) return false;
  if (playerId in state.lastWords) return false;
  return p.diedOn.day === state.day && state.phase !== 'night' && state.phase !== 'roleReveal';
}

export function submitLastWords(state: GameState, playerId: string, text: string, now: number): string | null {
  if (!canLeaveLastWords(state, playerId)) return 'You cannot leave last words now.';
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, LAST_WORDS_MAX);
  if (!clean) return 'Write something first.';
  state.lastWords[playerId] = clean;
  addLog(state, now, 'death', `Last words of ${getPlayer(state, playerId)!.name}: "${clean}"`);
  return null;
}

export function addLog(state: GameState, now: number, kind: LogEntry['kind'], text: string, onlyFor?: string[]) {
  state.log.push({ id: randomId(8), ts: now, kind, text, onlyFor });
}

export function addSystemChat(state: GameState, now: number, text: string, channel: ChatMessage['channel'] = 'public') {
  state.chat.push({ id: randomId(8), from: 'system', name: 'Narrator', text, channel, ts: now });
}

export const getPlayer = (state: GameState, id: string) => state.players.find((p) => p.id === id);
export const alivePlayers = (state: GameState) => state.players.filter((p) => p.alive);
export const aliveMafia = (state: GameState) => state.players.filter((p) => p.alive && isMafia(p.role));
export const mafiaMembers = (state: GameState) => state.players.filter((p) => isMafia(p.role));

// ---------------------------------------------------------------------------
// Role reveal
// ---------------------------------------------------------------------------

export function ackReveal(state: GameState, playerId: string) {
  if (state.phase !== 'roleReveal') return false;
  if (!getPlayer(state, playerId)) return false;
  if (!state.revealAcks.includes(playerId)) state.revealAcks.push(playerId);
  return true;
}

export const allRevealed = (state: GameState) =>
  state.players.filter((p) => p.connected).every((p) => state.revealAcks.includes(p.id));

// ---------------------------------------------------------------------------
// Night
// ---------------------------------------------------------------------------

function rollEvent(state: GameState, pool: GameEventId[], now: number): GameEventId | null {
  if (!state.settings.randomEvents) return null;
  const rng = createRng(state.seed + state.day * 7919 + (state.phase === 'night' ? 1 : 2) + now % 1000);
  if (rng.next() >= state.settings.eventChance) return null;
  return rng.pick(pool);
}

export function beginNight(state: GameState, now: number) {
  state.day += 1;
  state.phase = 'night';
  state.phaseStartedAt = now;
  state.phaseEndsAt = now + state.settings.nightSeconds * 1000;
  state.actions = emptyActions();
  state.votes = [];
  state.revoteCandidates = null;
  state.revoteCount = 0;
  state.doubleVoter = null;
  state.bread = [];
  state.trial = null;
  state.players.forEach((p) => (p.silenced = false));
  state.activeEvent = rollEvent(state, NIGHT_EVENTS, now);
  if (state.activeEvent === 'peaceful_night' && state.day === 1) state.activeEvent = null;
  addLog(state, now, 'phase', `Night ${state.day} falls over the town.`);
  if (state.activeEvent) {
    state.eventHistory.push({ phase: 'night', day: state.day, event: state.activeEvent });
    addLog(state, now, 'event', `${EVENTS[state.activeEvent].name}: ${EVENTS[state.activeEvent].description}`);
  }
}

/** The night prompts a given player currently has (empty when nothing to do). */
export function getNightPrompts(state: GameState, playerId: string): NightPrompt[] {
  const me = getPlayer(state, playerId);
  if (!me || state.phase !== 'night') return [];
  if (!me.alive) return [];
  const others = alivePlayers(state).filter((p) => p.id !== me.id).map((p) => p.id);
  const prompts: NightPrompt[] = [];
  const s = state.settings;
  const peaceful = state.activeEvent === 'peaceful_night';

  if (isMafia(me.role)) {
    if (state.day === 1 && !s.firstNightKill) {
      prompts.push({ kind: 'none', targets: [], canSkip: true, submitted: true, current: null, note: 'The Mafia meets tonight but makes no move. Learn your allies.' });
    } else if (peaceful) {
      prompts.push({ kind: 'none', targets: [], canSkip: true, submitted: true, current: null, note: 'A peaceful night: the Mafia cannot strike.' });
    } else {
      const targets = alivePlayers(state).filter((p) => !isMafia(p.role)).map((p) => p.id);
      prompts.push({
        kind: 'mafia',
        targets,
        canSkip: true,
        submitted: me.id in state.actions.mafia,
        current: state.actions.mafia[me.id] ?? null,
        note:
          state.activeEvent === 'blood_moon'
            ? 'Blood Moon: each Mafia member may pick a separate target.'
            : me.role === 'godfather'
              ? 'Your choice overrides the others.'
              : 'The Godfather decides if present; otherwise the majority.'
      });
    }
  }
  switch (me.role) {
    case 'detective':
      if (s.hardMode) {
        prompts.push({ kind: 'none', targets: [], canSkip: true, submitted: true, current: null, note: state.activeEvent === 'fog' ? 'Thick fog: no clues can be found tonight.' : 'Hard mode: you gather evidence tonight. Three clues arrive at dawn. Exactly one of them points to the Mafia.' });
        break;
      }
      prompts.push({
        kind: 'detective',
        targets: others,
        canSkip: true,
        submitted: me.id in state.actions.detective,
        current: state.actions.detective[me.id] ?? null,
        note: state.activeEvent === 'fog' ? 'Thick fog: your investigation will yield nothing tonight.' : undefined
      });
      break;
    case 'doctor': {
      const last = me.lastTarget;
      const targets = alivePlayers(state)
        .filter((p) => (s.doctorSelfHeal || p.id !== me.id) && p.id !== last)
        .map((p) => p.id);
      prompts.push({ kind: 'doctor', targets, canSkip: true, submitted: me.id in state.actions.doctor, current: state.actions.doctor[me.id] ?? null, note: last ? 'You cannot protect the same player twice in a row.' : undefined });
      break;
    }
    case 'bodyguard':
      if (me.guardTarget) {
        const t = getPlayer(state, me.guardTarget);
        prompts.push({ kind: 'none', targets: [], canSkip: true, submitted: true, current: null, note: me.guardUsed ? `Your shield on ${t?.name} has been spent.` : `You are guarding ${t?.name}. Your shield is intact.` });
      } else {
        prompts.push({ kind: 'bodyguard', targets: others, canSkip: true, submitted: me.id in state.actions.bodyguard, current: state.actions.bodyguard[me.id] ?? null, note: 'Permanent choice. You may wait and decide another night.' });
      }
      break;
    case 'sheriff':
      if ((me.shotsLeft ?? 0) > 0 && !peaceful) {
        prompts.push({ kind: 'sheriff', targets: others, canSkip: true, submitted: me.id in state.actions.sheriff, current: state.actions.sheriff[me.id] ?? null, note: `${me.shotsLeft} shot${me.shotsLeft === 1 ? '' : 's'} left.${s.sheriffGuilt ? ' Shooting an innocent will cost you your life.' : ''}` });
      } else {
        prompts.push({ kind: 'none', targets: [], canSkip: true, submitted: true, current: null, note: peaceful ? 'A peaceful night: no shots can be fired.' : 'You have no bullets left.' });
      }
      break;
    case 'silencer':
      prompts.push({ kind: 'silencer', targets: alivePlayers(state).filter((p) => !isMafia(p.role)).map((p) => p.id), canSkip: true, submitted: me.id in state.actions.silencer, current: state.actions.silencer[me.id] ?? null });
      break;
    case 'survivor':
      if ((me.vestsLeft ?? 0) > 0) {
        prompts.push({ kind: 'survivor', targets: [], canSkip: true, submitted: me.id in state.actions.survivor, current: state.actions.survivor[me.id] ?? false, note: `${me.vestsLeft} vest${me.vestsLeft === 1 ? '' : 's'} left.` });
      } else {
        prompts.push({ kind: 'none', targets: [], canSkip: true, submitted: true, current: null, note: 'You have no vests left.' });
      }
      break;
    case 'cupid': {
      const lovers = state.players.filter((p) => p.loverId);
      if (state.day === 1 && lovers.length === 0) {
        prompts.push({ kind: 'cupid', pick: 2, targets: alivePlayers(state).map((p) => p.id), canSkip: true, submitted: me.id in state.actions.cupid, current: state.actions.cupid[me.id] ?? null, note: 'Choose two players to fall in love. You may choose yourself.' });
      } else if (lovers.length >= 2) {
        prompts.push({ kind: 'none', targets: [], canSkip: true, submitted: true, current: null, note: `Your arrow has flown. ${lovers[0].name} and ${lovers[1].name} are bound together.` });
      } else {
        prompts.push({ kind: 'none', targets: [], canSkip: true, submitted: true, current: null, note: 'Your arrow can only fly on the first night.' });
      }
      break;
    }
    case 'baker':
      prompts.push({ kind: 'baker', targets: others, canSkip: true, submitted: me.id in state.actions.baker, current: state.actions.baker[me.id] ?? null, note: 'Your bread doubles their vote tomorrow. Everyone will see who got it.' });
      break;
    case 'bomb':
      prompts.push({ kind: 'none', targets: [], canSkip: true, submitted: true, current: null, note: 'You are wired to blow. If you are killed, your killer comes with you.' });
      break;
    default:
      break;
  }
  if (prompts.length === 0) {
    prompts.push({ kind: 'none', targets: [], canSkip: true, submitted: true, current: null, note: 'You have no night action. Rest, and listen carefully tomorrow.' });
  }
  return prompts;
}

export type NightActionKind = Exclude<NightPrompt['kind'], 'none'>;

/** Validates and records a night action. Returns an error string or null. */
export function submitNightAction(
  state: GameState,
  playerId: string,
  kind: NightActionKind,
  target: string | null | boolean | string[]
): string | null {
  if (state.phase !== 'night') return 'It is not night.';
  const me = getPlayer(state, playerId);
  if (!me || !me.alive) return 'You cannot act.';
  const prompt = getNightPrompts(state, playerId).find((p) => p.kind === kind);
  if (!prompt) return 'You do not have that ability.';
  if (kind === 'survivor') {
    state.actions.survivor[playerId] = Boolean(target);
    return null;
  }
  if (kind === 'cupid') {
    if (target === null || target === false) {
      state.actions.cupid[playerId] = null;
      return null;
    }
    if (!Array.isArray(target) || target.length !== 2 || target[0] === target[1]) return 'Choose exactly two different players.';
    if (!target.every((t) => typeof t === 'string' && prompt.targets.includes(t))) return 'Invalid target.';
    state.actions.cupid[playerId] = [target[0], target[1]];
    return null;
  }
  if (target === null || target === false) {
    if (!prompt.canSkip) return 'You must choose a target.';
    (state.actions[kind] as unknown as Record<string, string | null>)[playerId] = null;
    return null;
  }
  if (typeof target !== 'string' || !prompt.targets.includes(target)) return 'Invalid target.';
  (state.actions[kind] as unknown as Record<string, string | null>)[playerId] = target;
  return null;
}

export function allNightActionsIn(state: GameState) {
  return alivePlayers(state)
    .filter((p) => p.connected)
    .every((p) => getNightPrompts(state, p.id).every((pr) => pr.submitted));
}

function decideMafiaTargets(state: GameState, rng: ReturnType<typeof createRng>): string[] {
  const members = aliveMafia(state);
  const choices = members
    .map((m) => ({ m, t: state.actions.mafia[m.id] }))
    .filter((x) => x.t !== undefined);
  if (state.activeEvent === 'blood_moon') {
    return Array.from(new Set(choices.map((c) => c.t).filter((t): t is string => !!t)));
  }
  const gf = choices.find((c) => c.m.role === 'godfather');
  if (gf) return gf.t ? [gf.t] : [];
  const tally = new Map<string | null, number>();
  choices.forEach((c) => tally.set(c.t ?? null, (tally.get(c.t ?? null) ?? 0) + 1));
  if (tally.size === 0) return [];
  const max = Math.max(...tally.values());
  const top = [...tally.entries()].filter(([, n]) => n === max).map(([t]) => t);
  const pick = top.length === 1 ? top[0] : rng.pick(top);
  return pick ? [pick] : [];
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Builds a crime-scene report for a night death, deterministic per game/night/player. */
export function makeScene(state: GameState, playerId: string, cause: DeathCause): CrimeScene {
  const idx = state.players.findIndex((p) => p.id === playerId);
  const rng = createRng(state.seed + state.day * 7727 + idx * 131 + cause.length);
  const map = MAPS[state.map] ?? MAPS.village;
  const hour = [23, 0, 1, 2, 3, 4][rng.int(6)];
  return {
    room: rng.pick(map.rooms),
    method: CAUSE_METHOD[cause] ?? rng.pick(map.methods),
    time: `${pad2(hour)}:${pad2(rng.int(60))}`,
    clue: rng.pick(CLUES)
  };
}

/**
 * Applies chained deaths: a Bomb takes its killer with it, a lover dies of heartbreak.
 * `deaths` is extended in place; `dead` tracks everyone already dying in this resolution.
 */
function chainDeaths(state: GameState, deaths: Death[], dead: Set<string>, rng: ReturnType<typeof createRng>, voters: string[] = []) {
  for (let i = 0; i < deaths.length; i++) {
    const d = deaths[i];
    const victim = getPlayer(state, d.playerId);
    if (!victim) continue;
    if (victim.role === 'bomb' && (d.cause === 'mafia' || d.cause === 'sheriff' || d.cause === 'vote')) {
      let pool: string[] = [];
      if (d.cause === 'mafia') pool = alivePlayers(state).filter((p) => isMafia(p.role)).map((p) => p.id);
      else if (d.cause === 'sheriff' && d.by) pool = [d.by];
      else if (d.cause === 'vote') pool = voters;
      pool = pool.filter((id) => !dead.has(id) && getPlayer(state, id)?.alive);
      if (pool.length) {
        const hit = rng.pick(pool);
        dead.add(hit);
        deaths.push({ playerId: hit, cause: 'bomb', by: victim.id });
      }
    }
    if (victim.loverId && !dead.has(victim.loverId) && getPlayer(state, victim.loverId)?.alive) {
      dead.add(victim.loverId);
      deaths.push({ playerId: victim.loverId, cause: 'heartbreak', by: victim.id });
    }
  }
}

export function resolveNight(state: GameState, now: number): NightReport {
  if (state.phase !== 'night') throw new Error('Not night');
  const rng = createRng(state.seed + state.day * 104729);
  const s = state.settings;
  const peaceful = state.activeEvent === 'peaceful_night';
  const report: NightReport = {
    night: state.day,
    deaths: [],
    saved: false,
    guarded: false,
    silenced: null,
    investigations: {},
    mafiaTarget: null,
    peaceful,
    bread: [],
    lovers: false,
    clues: {}
  };

  // Cupid binds the lovers first, so tonight's kills can already break hearts.
  for (const [cupidId, pair] of Object.entries(state.actions.cupid)) {
    if (!pair || state.players.some((p) => p.loverId)) continue;
    const [a, b] = pair.map((id) => getPlayer(state, id));
    if (!a || !b || !a.alive || !b.alive) continue;
    a.loverId = b.id;
    b.loverId = a.id;
    report.lovers = true;
    addLog(state, now, 'info', `Cupid's arrow struck. You are in love with ${b.name}. If one of you dies, so does the other.`, [a.id]);
    addLog(state, now, 'info', `Cupid's arrow struck. You are in love with ${a.name}. If one of you dies, so does the other.`, [b.id]);
    if (cupidId !== a.id && cupidId !== b.id) addLog(state, now, 'info', `Your arrow flew true. ${a.name} and ${b.name} are now lovers.`, [cupidId]);
  }

  // Bodyguard choices become permanent.
  for (const [bgId, target] of Object.entries(state.actions.bodyguard)) {
    const bg = getPlayer(state, bgId);
    if (bg && target && !bg.guardTarget) {
      bg.guardTarget = target;
      bg.guardUsed = false;
      addLog(state, now, 'info', `You are now guarding ${getPlayer(state, target)?.name}.`, [bgId]);
    }
  }

  const protectedByDoctor = new Set<string>();
  for (const [docId, target] of Object.entries(state.actions.doctor)) {
    const doc = getPlayer(state, docId);
    if (target) {
      protectedByDoctor.add(target);
      if (doc) doc.lastTarget = target;
    } else if (doc) doc.lastTarget = undefined;
  }
  const vested = new Set<string>();
  for (const [survId, used] of Object.entries(state.actions.survivor)) {
    const sv = getPlayer(state, survId);
    if (sv && used && (sv.vestsLeft ?? 0) > 0) {
      sv.vestsLeft = (sv.vestsLeft ?? 0) - 1;
      vested.add(survId);
      addLog(state, now, 'info', `You put on a vest. ${sv.vestsLeft} left.`, [survId]);
    }
  }

  const attacks: { target: string; cause: 'mafia' | 'sheriff'; by?: string }[] = [];
  const mafiaTargets = peaceful || (state.day === 1 && !s.firstNightKill) ? [] : decideMafiaTargets(state, rng);
  report.mafiaTarget = mafiaTargets[0] ?? null;
  mafiaTargets.forEach((t) => attacks.push({ target: t, cause: 'mafia' }));
  if (!peaceful) {
    for (const [shId, target] of Object.entries(state.actions.sheriff)) {
      const sh = getPlayer(state, shId);
      if (sh && sh.alive && target && (sh.shotsLeft ?? 0) > 0) {
        sh.shotsLeft = (sh.shotsLeft ?? 0) - 1;
        attacks.push({ target, cause: 'sheriff', by: shId });
      }
    }
  }

  const deaths: Death[] = [];
  const dead = new Set<string>();
  for (const atk of attacks) {
    const victim = getPlayer(state, atk.target);
    if (!victim || !victim.alive || dead.has(victim.id)) continue;
    if (protectedByDoctor.has(victim.id)) {
      report.saved = true;
      addLog(state, now, 'info', `Someone attacked ${victim.name}, but you saved them!`, Object.keys(state.actions.doctor).filter((d) => state.actions.doctor[d] === victim.id));
      continue;
    }
    const guard = state.players.find((p) => p.role === 'bodyguard' && p.alive && p.guardTarget === victim.id && !p.guardUsed);
    if (guard) {
      guard.guardUsed = true;
      report.guarded = true;
      addLog(state, now, 'info', `Your shield blocked an attack on ${victim.name}. It is now spent.`, [guard.id]);
      continue;
    }
    if (vested.has(victim.id)) {
      report.saved = true;
      addLog(state, now, 'info', 'Your vest stopped an attack tonight!', [victim.id]);
      continue;
    }
    dead.add(victim.id);
    deaths.push({ playerId: victim.id, cause: atk.cause, by: atk.by });
    if (atk.cause === 'sheriff' && atk.by && s.sheriffGuilt && teamOf(victim.role) === 'town') {
      const sh = getPlayer(state, atk.by);
      if (sh && sh.alive && !dead.has(sh.id)) {
        dead.add(sh.id);
        deaths.push({ playerId: sh.id, cause: 'guilt' });
      }
    }
  }

  chainDeaths(state, deaths, dead, rng);

  for (const [detId, target] of Object.entries(state.actions.detective)) {
    if (!target || state.activeEvent === 'fog') continue;
    const t = getPlayer(state, target);
    if (!t) continue;
    const result = isMafia(t.role) && t.role !== 'godfather' ? 'suspicious' : 'innocent';
    report.investigations[detId] = { targetId: target, result };
    addLog(state, now, 'info', `Investigation: ${t.name} is ${result.toUpperCase()}.`, [detId]);
  }

  if (s.hardMode && state.activeEvent !== 'fog') {
    const living = state.players.filter((p) => p.alive && !dead.has(p.id));
    for (const det of living.filter((p) => p.role === 'detective')) {
      const evil = living.filter((p) => isMafia(p.role));
      const good = living.filter((p) => !isMafia(p.role) && p.id !== det.id);
      if (!evil.length) continue;
      const picks = [rng.pick(evil), ...rng.shuffle(good).slice(0, 2)];
      const words = rng.shuffle(picks.map((p) => rng.pick(traitById(p.trait)?.words ?? ['nothing', 'nothing', 'nothing'])));
      report.clues[det.id] = words;
      addLog(state, now, 'info', `Clues found: ${words.join(', ')}. One of them points to the Mafia.`, [det.id]);
    }
  }

  for (const [, target] of Object.entries(state.actions.silencer)) {
    if (target && !dead.has(target)) {
      const t = getPlayer(state, target);
      if (t) {
        t.silenced = true;
        report.silenced = target;
      }
    }
  }

  for (const d of deaths) {
    const p = getPlayer(state, d.playerId)!;
    p.alive = false;
    p.diedOn = { phase: 'night', day: state.day, cause: d.cause };
    d.scene = makeScene(state, d.playerId, d.cause);
  }
  report.deaths = deaths;

  // The Baker's bread goes to the living.
  for (const [, target] of Object.entries(state.actions.baker)) {
    const t = target ? getPlayer(state, target) : undefined;
    if (t && t.alive && !report.bread.includes(t.id)) report.bread.push(t.id);
  }
  state.bread = report.bread;
  state.nightReports.push(report);

  // Announce
  state.phase = 'dayAnnounce';
  state.phaseStartedAt = now;
  state.phaseEndsAt = now + ANNOUNCE_SECONDS * 1000;
  state.activeEvent = null;
  addLog(state, now, 'phase', `Day ${state.day} dawns.`);
  if (deaths.length === 0) {
    addLog(state, now, 'info', peaceful ? 'A peaceful night. Everyone wakes safely.' : 'Nobody died last night.');
  }
  for (const d of deaths) {
    const p = getPlayer(state, d.playerId)!;
    const where = d.scene ? d.scene.room : 'the street';
    const msg =
      d.cause === 'mafia' ? `${p.name} was found dead in ${where}.`
      : d.cause === 'sheriff' ? `${p.name} was shot by the Sheriff in ${where}.`
      : d.cause === 'guilt' ? `${p.name} died of guilt.`
      : d.cause === 'bomb' ? `${p.name} was killed in a bomb blast.`
      : `${p.name} died of a broken heart.`;
    addLog(state, now, 'death', msg);
    if (s.revealRolesOnDeath) addLog(state, now, 'death', `${p.name} was the ${ROLES[p.role].name}.`);
  }
  for (const id of report.bread) {
    addLog(state, now, 'event', `${getPlayer(state, id)?.name} woke up to fresh bread. Their vote counts double today.`);
  }
  if (report.saved) addLog(state, now, 'info', 'Someone was attacked but survived!');
  if (report.guarded) addLog(state, now, 'info', 'A Bodyguard blocked an attack.');
  if (report.silenced) addLog(state, now, 'info', `${getPlayer(state, report.silenced)?.name} has been silenced and cannot speak today.`);

  const win = checkWin(state);
  if (win) endGame(state, win, now);
  return report;
}

// ---------------------------------------------------------------------------
// Day
// ---------------------------------------------------------------------------

export function beginDiscussion(state: GameState, now: number) {
  state.phase = 'discussion';
  state.phaseStartedAt = now;
  state.activeEvent = rollEvent(state, DAY_EVENTS, now);
  let secs = state.settings.discussionSeconds;
  if (state.activeEvent) {
    state.eventHistory.push({ phase: 'discussion', day: state.day, event: state.activeEvent });
    addLog(state, now, 'event', `${EVENTS[state.activeEvent].name}: ${EVENTS[state.activeEvent].description}`);
    if (state.activeEvent === 'short_fuse') secs = Math.max(20, Math.floor(secs / 2));
    if (state.activeEvent === 'double_vote') {
      const rng = createRng(state.seed + state.day * 31337);
      const elder = rng.pick(alivePlayers(state));
      state.doubleVoter = elder.id;
      addLog(state, now, 'event', `${elder.name} is the Town Elder today. Their vote counts twice.`);
    }
  }
  state.phaseEndsAt = now + secs * 1000;
}

export function beginVoting(state: GameState, now: number, revoteCandidates: string[] | null = null) {
  state.phase = 'voting';
  state.phaseStartedAt = now;
  state.phaseEndsAt = now + state.settings.votingSeconds * 1000;
  state.votes = [];
  state.revoteCandidates = revoteCandidates;
  addLog(state, now, 'phase', revoteCandidates ? 'The vote is tied. A revote begins between the tied players.' : 'The town gathers to vote.');
}

export function voteCandidates(state: GameState): string[] {
  const alive = alivePlayers(state).map((p) => p.id);
  return state.revoteCandidates ? alive.filter((id) => state.revoteCandidates!.includes(id)) : alive;
}

export function castVote(state: GameState, voterId: string, targetId: string | null): string | null {
  if (state.phase !== 'voting') return 'Voting is not open.';
  const voter = getPlayer(state, voterId);
  if (!voter || !voter.alive) return 'You cannot vote.';
  if (targetId === null && !state.settings.allowSkipVote) return 'Skipping is not allowed.';
  if (targetId !== null) {
    if (targetId === voterId) return 'You cannot vote for yourself.';
    if (!voteCandidates(state).includes(targetId)) return 'Invalid target.';
  }
  const existing = state.votes.find((v) => v.voterId === voterId);
  if (existing) existing.targetId = targetId;
  else state.votes.push({ voterId, targetId });
  return null;
}

export function allVotesIn(state: GameState) {
  const voters = alivePlayers(state).filter((p) => p.connected);
  return voters.every((p) => state.votes.some((v) => v.voterId === p.id));
}

export function voteWeight(state: GameState, voterId: string) {
  return 1 + (state.doubleVoter === voterId ? 1 : 0) + (state.bread.includes(voterId) ? 1 : 0);
}

export function tallyVotes(state: GameState): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const v of state.votes) {
    const key = v.targetId ?? 'skip';
    tally[key] = (tally[key] ?? 0) + voteWeight(state, v.voterId);
  }
  return tally;
}

export function resolveVotes(state: GameState, now: number): VoteResult {
  if (state.phase !== 'voting') throw new Error('Not voting');
  const s = state.settings;
  const tally = tallyVotes(state);
  const playerEntries = Object.entries(tally).filter(([k]) => k !== 'skip');
  const max = playerEntries.length ? Math.max(...playerEntries.map(([, n]) => n)) : 0;
  const top = playerEntries.filter(([, n]) => n === max).map(([id]) => id);
  const skipVotes = tally.skip ?? 0;
  const totalWeight = alivePlayers(state).reduce((a, p) => a + voteWeight(state, p.id), 0);

  let eliminated: string | null = null;
  let tie = false;
  let revote = false;
  let tiedIds: string[] = [];

  if (max > 0) {
    if (s.voteMode === 'majority') {
      if (top.length === 1 && max * 2 > totalWeight) eliminated = top[0];
    } else if (top.length === 1 && max > skipVotes) {
      eliminated = top[0];
    } else if (top.length > 1 && max >= skipVotes) {
      tie = true;
      tiedIds = top;
      if (s.tieRule === 'random') {
        eliminated = createRng(state.seed + state.day * 1543 + state.revoteCount).pick(top);
      } else if (s.tieRule === 'revote' && state.revoteCount === 0) {
        revote = true;
      }
    }
  }

  const result: VoteResult = { day: state.day, tally, votes: [...state.votes], eliminated, tie, revote, tiedIds, jesterWin: false, extraDeaths: [] };

  if (revote) {
    state.voteResults.push(result);
    state.revoteCount += 1;
    beginVoting(state, now, tiedIds);
    return result;
  }

  if (eliminated && s.trial) {
    // The accused gets to defend themselves before the town decides.
    state.trial = { accused: eliminated, nomination: result, verdicts: {} };
    state.phase = 'defense';
    state.phaseStartedAt = now;
    state.phaseEndsAt = now + s.defenseSeconds * 1000;
    addLog(state, now, 'vote', `${getPlayer(state, eliminated)!.name} is put on trial. They have ${s.defenseSeconds} seconds to defend themselves.`);
    return result;
  }
  return finishVote(state, now, result, eliminated, tie, false);
}

/** Applies the outcome of a vote (or trial): elimination, chains, logs, win check. */
function finishVote(state: GameState, now: number, result: VoteResult, eliminated: string | null, tie: boolean, quiet: boolean): VoteResult {
  const s = state.settings;
  result.eliminated = eliminated;
  if (eliminated) {
    const p = getPlayer(state, eliminated)!;
    p.alive = false;
    p.diedOn = { phase: 'day', day: state.day, cause: 'vote' };
    addLog(state, now, 'vote', `The town has voted out ${p.name}.`);
    if (s.revealRolesOnDeath) addLog(state, now, 'vote', `${p.name} was the ${ROLES[p.role].name}.`);
    if (p.role === 'jester') {
      p.jesterWon = true;
      result.jesterWin = true;
      addLog(state, now, 'win', `${p.name} was the Jester and wins by being voted out!`);
    }
    // Chains: the Bomb takes a voter with it, lovers follow each other.
    const chain: Death[] = [{ playerId: p.id, cause: 'vote' }];
    const dead = new Set([p.id]);
    const voters = state.votes.filter((v) => v.targetId === p.id).map((v) => v.voterId);
    chainDeaths(state, chain, dead, createRng(state.seed + state.day * 3571), voters);
    for (const d of chain.slice(1)) {
      const x = getPlayer(state, d.playerId)!;
      x.alive = false;
      x.diedOn = { phase: 'day', day: state.day, cause: d.cause };
      result.extraDeaths.push(d);
      addLog(state, now, 'death', d.cause === 'bomb' ? `${p.name} was a Bomb. The blast killed ${x.name}.` : `${x.name} could not live without ${getPlayer(state, d.by!)?.name} and died of a broken heart.`);
      if (s.revealRolesOnDeath) addLog(state, now, 'death', `${x.name} was the ${ROLES[x.role].name}.`);
    }
  } else if (quiet) {
    // outcome already logged (trial acquittal)
  } else if (tie) {
    addLog(state, now, 'vote', 'The vote was tied. Nobody is eliminated.');
  } else {
    addLog(state, now, 'vote', 'The town could not agree. Nobody is eliminated.');
  }

  state.voteResults.push(result);
  state.phase = 'voteResult';
  state.phaseStartedAt = now;
  state.phaseEndsAt = now + VOTE_RESULT_SECONDS * 1000;
  state.doubleVoter = null;
  state.bread = [];
  state.activeEvent = null;
  const win = checkWin(state);
  if (win) endGame(state, win, now);
  return result;
}

// ---------------------------------------------------------------------------
// Trial: defense, then guilty / innocent
// ---------------------------------------------------------------------------

export function beginJudgment(state: GameState, now: number) {
  if (!state.trial) return;
  state.phase = 'judgment';
  state.phaseStartedAt = now;
  state.phaseEndsAt = now + state.settings.judgmentSeconds * 1000;
  addLog(state, now, 'vote', `The town must decide: is ${getPlayer(state, state.trial.accused)!.name} guilty?`);
}

export function judgmentVoters(state: GameState) {
  return alivePlayers(state).filter((p) => p.id !== state.trial?.accused);
}

export function castJudgment(state: GameState, voterId: string, verdict: Verdict): string | null {
  if (state.phase !== 'judgment' || !state.trial) return 'Judgment is not open.';
  const voter = getPlayer(state, voterId);
  if (!voter || !voter.alive) return 'You cannot vote.';
  if (voterId === state.trial.accused) return 'The accused cannot judge themselves.';
  if (verdict !== 'guilty' && verdict !== 'innocent' && verdict !== 'abstain') return 'Invalid verdict.';
  state.trial.verdicts[voterId] = verdict;
  return null;
}

export function allJudgmentsIn(state: GameState) {
  if (!state.trial) return true;
  return judgmentVoters(state).filter((p) => p.connected).every((p) => p.id in state.trial!.verdicts);
}

export function resolveJudgment(state: GameState, now: number): VoteResult {
  const trial = state.trial;
  if (state.phase !== 'judgment' || !trial) throw new Error('Not judgment');
  let guilty = 0;
  let innocent = 0;
  const votes = Object.entries(trial.verdicts).map(([voterId, verdict]) => {
    const w = voteWeight(state, voterId);
    if (verdict === 'guilty') guilty += w;
    else if (verdict === 'innocent') innocent += w;
    return { voterId, verdict };
  });
  const executed = guilty > innocent;
  const result = trial.nomination;
  result.trial = { accused: trial.accused, guilty, innocent, votes, spared: !executed };
  const name = getPlayer(state, trial.accused)!.name;
  addLog(state, now, 'vote', executed ? `Guilty, ${guilty} to ${innocent}. ${name} will be executed.` : `Not guilty, ${innocent} to ${guilty}. The town spares ${name}.`);
  state.trial = null;
  return finishVote(state, now, result, executed ? trial.accused : null, false, !executed);
}

// ---------------------------------------------------------------------------
// Win conditions
// ---------------------------------------------------------------------------

export function checkWin(state: GameState): WinInfo | null {
  const alive = alivePlayers(state);
  const mafia = alive.filter((p) => isMafia(p.role)).length;
  const others = alive.length - mafia;
  let team: Team | 'draw' | null = null;
  let reason = '';
  if (alive.length === 0) {
    team = 'draw';
    reason = 'Nobody survived.';
  } else if (mafia === 0) {
    team = 'town';
    reason = 'All Mafia have been eliminated.';
  } else if (mafia >= others) {
    team = 'mafia';
    reason = 'The Mafia now controls the town.';
  }
  if (!team) return null;
  const winners = new Set<string>();
  for (const p of state.players) {
    if (team !== 'draw' && teamOf(p.role) === team) winners.add(p.id);
    if (p.role === 'survivor' && p.alive) winners.add(p.id);
    if (p.role === 'jester' && p.jesterWon) winners.add(p.id);
  }
  return { team, winners: [...winners], reason };
}

export function endGame(state: GameState, win: WinInfo, now: number) {
  state.phase = 'gameOver';
  state.winner = win;
  state.endedAt = now;
  state.phaseEndsAt = null;
  state.phaseStartedAt = now;
  const label = win.team === 'draw' ? 'The game ends in a draw.' : `${win.team === 'town' ? 'The Town' : win.team === 'mafia' ? 'The Mafia' : 'Neutrals'} win!`;
  addLog(state, now, 'win', `${label} ${win.reason}`);
}

// ---------------------------------------------------------------------------
// Generic phase advance (timer expiry / host skip / local "continue")
// ---------------------------------------------------------------------------

export function advance(state: GameState, now: number): Phase {
  switch (state.phase) {
    case 'roleReveal':
      beginNight(state, now);
      break;
    case 'night':
      resolveNight(state, now);
      break;
    case 'dayAnnounce':
      beginDiscussion(state, now);
      break;
    case 'discussion':
      beginVoting(state, now);
      break;
    case 'voting':
      resolveVotes(state, now);
      break;
    case 'defense':
      beginJudgment(state, now);
      break;
    case 'judgment':
      resolveJudgment(state, now);
      break;
    case 'voteResult': {
      const win = checkWin(state);
      if (win) endGame(state, win, now);
      else beginNight(state, now);
      break;
    }
    default:
      break;
  }
  return state.phase;
}

/** Whether the current phase is ready to auto-advance (everyone acted). */
export function phaseComplete(state: GameState): boolean {
  switch (state.phase) {
    case 'roleReveal':
      return allRevealed(state);
    case 'night':
      return allNightActionsIn(state);
    case 'voting':
      return allVotesIn(state);
    case 'judgment':
      return allJudgmentsIn(state);
    default:
      return false;
  }
}

export function timerExpired(state: GameState, now: number) {
  return state.phaseEndsAt !== null && now >= state.phaseEndsAt;
}

/** Removes a player from a running game (left permanently). Treated as a death with no cause announcement. */
export function removePlayer(state: GameState, playerId: string, now: number) {
  const p = getPlayer(state, playerId);
  if (!p || !p.alive) return;
  p.alive = false;
  p.connected = false;
  p.diedOn = { phase: state.phase === 'night' ? 'night' : 'day', day: state.day, cause: 'vote' };
  addLog(state, now, 'info', `${p.name} has left the town.`);
  if (state.settings.revealRolesOnDeath) addLog(state, now, 'info', `${p.name} was the ${ROLES[p.role].name}.`);
  const win = checkWin(state);
  if (win && state.phase !== 'gameOver') endGame(state, win, now);
}
