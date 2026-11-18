import type { MatchRecord } from '../../shared/protocol';
import type { RoleId, Team } from '../../engine';
import { safeStorage } from './env';

const KEY = 'nightfall.history.v1';

export function loadLocalHistory(): MatchRecord[] {
  try {
    return JSON.parse(safeStorage.get(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveLocalMatch(m: MatchRecord) {
  const all = loadLocalHistory();
  if (all.some((x) => x.id === m.id)) return;
  all.unshift(m);
  safeStorage.set(KEY, JSON.stringify(all.slice(0, 200)));
}

export interface PlayerStats {
  games: number;
  wins: number;
  survived: number;
  byTeam: Record<Team, { games: number; wins: number }>;
  byRole: Partial<Record<RoleId, { games: number; wins: number }>>;
  streak: number;
  bestStreak: number;
}

export function computeStats(matches: MatchRecord[], playerIds: string[], names: string[] = []): PlayerStats {
  const s: PlayerStats = {
    games: 0, wins: 0, survived: 0,
    byTeam: { town: { games: 0, wins: 0 }, mafia: { games: 0, wins: 0 }, neutral: { games: 0, wins: 0 } },
    byRole: {}, streak: 0, bestStreak: 0
  };
  const teamOf = (r: RoleId): Team => (['mafia', 'godfather', 'silencer'].includes(r) ? 'mafia' : ['jester', 'survivor'].includes(r) ? 'neutral' : 'town');
  let streak = 0;
  const ordered = [...matches].sort((a, b) => a.endedAt - b.endedAt);
  for (const m of ordered) {
    const me = m.players.find((p) => playerIds.includes(p.id)) ?? m.players.find((p) => names.includes(p.name));
    if (!me) continue;
    s.games++;
    if (me.won) s.wins++;
    if (me.alive) s.survived++;
    const t = teamOf(me.role);
    s.byTeam[t].games++;
    if (me.won) s.byTeam[t].wins++;
    const r = (s.byRole[me.role] ??= { games: 0, wins: 0 });
    r.games++;
    if (me.won) r.wins++;
    streak = me.won ? streak + 1 : 0;
    s.bestStreak = Math.max(s.bestStreak, streak);
  }
  s.streak = streak;
  return s;
}
