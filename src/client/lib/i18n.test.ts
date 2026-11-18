import { describe, it, expect, beforeAll } from 'vitest';
import { setPrefs } from './prefs';
import { t } from './i18n';
import { TRAITS, ROLES, EVENTS, MAPS, CLUES, CAUSE_METHOD, createGame, defaultSettings, ackReveal, advance, getNightPrompts, submitNightAction, castVote, castJudgment, alivePlayers, validateRoles } from '../../engine';
import type { RoleId } from '../../engine';

const SAME_OK = new Set(['Mafia', 'Sheriff', 'Godfather', 'Cupid', 'Nightfall', 'Host', 'OK', 'Online', 'Volume', 'Data', 'Username', 'Password', 'Enter', 'ON', 'OFF', 'Menu', 'Voting', 'Mainframe', 'Sheriff shots', 'mint', 'lavender', 'stopwatch', 'jackpot', 'pedal', 'tripod', 'orbit', 'oven', 'Status']);

describe('Indonesian translation', () => {
  beforeAll(() => setPrefs({ lang: 'id' }));

  it('translates filled sentences via patterns, including nested room and role names', () => {
    expect(t('Ava was found dead in the kitchen.')).toBe('Ava ditemukan tewas di dapur.');
    expect(t('Ben was the Detective.')).toBe('Ben adalah Detektif.');
    expect(t('The Mafia win! The Mafia now controls the town.')).toBe('Mafia menang! Mafia kini menguasai kota.');
    expect(t('Town · {n} alive', { n: 4 })).toBe('Kota · 4 hidup');
    expect(t('Blood Moon: The Mafia is emboldened: every Mafia member may choose a separate target tonight.')).toContain('Bulan Darah');
  });

  it('covers every role, event, map, scene and every log line produced by real games', () => {
    const strings = new Set<string>();
    Object.values(ROLES).forEach((r) => [r.name, r.short, r.description].forEach((x) => strings.add(x)));
    Object.values(EVENTS).forEach((e) => [e.name, e.description].forEach((x) => strings.add(x)));
    Object.values(MAPS).forEach((m) => [m.name, m.description, ...m.rooms, ...m.methods].forEach((x) => strings.add(x)));
    CLUES.forEach((c) => strings.add(c));
    TRAITS.forEach((tr) => [tr.label, ...tr.words].forEach((x) => strings.add(x)));
    Object.values(CAUSE_METHOD).forEach((c) => strings.add(c!));
    const roleSets: Partial<Record<RoleId, number>>[] = [
      { godfather: 1, mafia: 1, silencer: 1, detective: 1, doctor: 1, bodyguard: 1, sheriff: 1, cupid: 1, baker: 1, bomb: 1, jester: 1, survivor: 1 },
      { mafia: 2, sheriff: 1, cupid: 1, bomb: 1, survivor: 1 }
    ];
    for (let seed = 1; seed <= 30; seed++) {
      const roles = roleSets[seed % 2];
      const n = 14;
      const lobby = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: i, isHost: i === 0 }));
      const s = { ...defaultSettings(n), roles, randomEvents: true, eventChance: 0.6, tieRule: (['noElimination', 'revote', 'random'] as const)[seed % 3], sheriffShots: 2, hardMode: seed % 3 === 0 };
      const st = createGame(lobby, s, seed * 7919, 0);
      st.players.forEach((p) => ackReveal(st, p.id));
      let clock = 1000;
      for (let step = 0; step < 200 && st.phase !== 'gameOver'; step++) {
        clock += 1000;
        if (st.phase === 'night') {
          for (const p of alivePlayers(st)) {
            for (const pr of getNightPrompts(st, p.id)) {
              if (pr.note) strings.add(pr.note);
              if (pr.kind === 'none') continue;
              if (pr.kind === 'survivor') submitNightAction(st, p.id, 'survivor', seed % 2 === 0);
              else if (pr.kind === 'cupid') submitNightAction(st, p.id, 'cupid', pr.targets.slice(0, 2));
              else if (pr.targets.length) submitNightAction(st, p.id, pr.kind, pr.targets[(seed + step) % pr.targets.length]);
            }
          }
        }
        if (st.phase === 'voting') {
          const alive = alivePlayers(st);
          const cands = st.revoteCandidates ?? alive.map((p) => p.id);
          alive.forEach((p, i) => castVote(st, p.id, cands.filter((c) => c !== p.id)[(i * seed) % Math.max(1, cands.length - 1)] ?? null));
        }
        if (st.phase === 'judgment' && st.trial) {
          alivePlayers(st).forEach((p, i) => p.id !== st.trial!.accused && castJudgment(st, p.id, (i + seed) % 3 === 0 ? 'innocent' : 'guilty'));
        }
        advance(st, clock);
      }
      st.log.forEach((l) => strings.add(l.text));
      if (st.winner) strings.add(st.winner.reason);
    }
    ['Too many special roles (9) for 6 players.', validateRoles({ ...defaultSettings(), roles: {} }, 6)!, 'At least 4 players are required.'].forEach((x) => strings.add(x));
    const untranslated = [...strings].filter((x) => !SAME_OK.has(x) && t(x) === x);
    if (untranslated.length) console.log('UNTRANSLATED', JSON.stringify([...new Set(untranslated.map((x) => x.replace(/P\d+/g, '{P}').replace(/\d+/g, '{n}')))], null, 1));
    expect(untranslated).toEqual([]);
  });
});
