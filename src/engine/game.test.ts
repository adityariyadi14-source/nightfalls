import { describe, it, expect } from 'vitest';
import {
  beginJudgment,
  castJudgment,
  resolveJudgment,
  submitLastWords,
  canLeaveLastWords,
  createGame,
  defaultSettings,
  ackReveal,
  advance,
  submitNightAction,
  castVote,
  resolveVotes,
  resolveNight,
  checkWin,
  buildView,
  getNightPrompts,
  beginVoting,
  validateRoles,
  TRAITS
} from './index';
import type { GameSettings, RoleId } from './index';

const lobby = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, avatar: i, isHost: i === 0 }));

function gameWith(roles: Partial<Record<RoleId, number>>, n: number, extra: Partial<GameSettings> = {}) {
  const s = { ...defaultSettings(n), roles, randomEvents: false, trial: false, ...extra };
  const st = createGame(lobby(n), s, 42, 1000);
  st.players.forEach((p) => ackReveal(st, p.id));
  advance(st, 2000); // -> night 1
  return st;
}
const byRole = (st: ReturnType<typeof gameWith>, r: RoleId) => st.players.filter((p) => p.role === r);

describe('setup', () => {
  it('assigns exactly the configured roles and fills with citizens', () => {
    const st = gameWith({ mafia: 2, detective: 1, doctor: 1 }, 8);
    expect(byRole(st, 'mafia').length).toBe(2);
    expect(byRole(st, 'detective').length).toBe(1);
    expect(byRole(st, 'doctor').length).toBe(1);
    expect(byRole(st, 'citizen').length).toBe(4);
  });
  it('rejects invalid configs', () => {
    expect(validateRoles({ ...defaultSettings(), roles: { mafia: 3 } }, 6)).toBeTruthy();
    expect(validateRoles({ ...defaultSettings(), roles: {} }, 6)).toBeTruthy();
    expect(validateRoles({ ...defaultSettings(), roles: { mafia: 1 } }, 3)).toBeTruthy();
    expect(validateRoles({ ...defaultSettings(), roles: { mafia: 1 } }, 4)).toBeNull();
  });
});

describe('night resolution', () => {
  it('mafia kill works and doctor save blocks it', () => {
    const st = gameWith({ mafia: 1, doctor: 1 }, 5);
    const mafia = byRole(st, 'mafia')[0];
    const doc = byRole(st, 'doctor')[0];
    const victim = byRole(st, 'citizen')[0];
    expect(submitNightAction(st, mafia.id, 'mafia', victim.id)).toBeNull();
    expect(submitNightAction(st, doc.id, 'doctor', victim.id)).toBeNull();
    const rep = resolveNight(st, 3000);
    expect(rep.deaths.length).toBe(0);
    expect(rep.saved).toBe(true);
    expect(st.phase).toBe('dayAnnounce');
  });
  it('kills without protection, godfather overrides, and appears innocent', () => {
    const st = gameWith({ mafia: 1, godfather: 1, detective: 1 }, 8);
    const gf = byRole(st, 'godfather')[0];
    const mafia = byRole(st, 'mafia')[0];
    const det = byRole(st, 'detective')[0];
    const cits = byRole(st, 'citizen');
    submitNightAction(st, mafia.id, 'mafia', cits[0].id);
    submitNightAction(st, gf.id, 'mafia', cits[1].id);
    submitNightAction(st, det.id, 'detective', gf.id);
    const rep = resolveNight(st, 3000);
    expect(rep.deaths.map((d) => d.playerId)).toEqual([cits[1].id]);
    expect(rep.investigations[det.id].result).toBe('innocent');
    expect(st.players.find((p) => p.id === cits[1].id)!.alive).toBe(false);
  });
  it('detective sees mafia as suspicious', () => {
    const st = gameWith({ mafia: 1, detective: 1 }, 5);
    const det = byRole(st, 'detective')[0];
    const mafia = byRole(st, 'mafia')[0];
    submitNightAction(st, det.id, 'detective', mafia.id);
    submitNightAction(st, mafia.id, 'mafia', null);
    const rep = resolveNight(st, 3000);
    expect(rep.investigations[det.id].result).toBe('suspicious');
  });
  it('bodyguard shield is permanent and one-time', () => {
    const st = gameWith({ mafia: 1, bodyguard: 1 }, 6);
    const bg = byRole(st, 'bodyguard')[0];
    const mafia = byRole(st, 'mafia')[0];
    const cit = byRole(st, 'citizen')[0];
    submitNightAction(st, bg.id, 'bodyguard', cit.id);
    submitNightAction(st, mafia.id, 'mafia', cit.id);
    let rep = resolveNight(st, 3000);
    expect(rep.guarded).toBe(true);
    expect(rep.deaths.length).toBe(0);
    advance(st, 4000); // discussion
    advance(st, 5000); // voting
    advance(st, 6000); // voteResult (nobody)
    advance(st, 7000); // night 2
    expect(getNightPrompts(st, bg.id)[0].kind).toBe('none');
    submitNightAction(st, mafia.id, 'mafia', cit.id);
    rep = resolveNight(st, 8000);
    expect(rep.deaths.map((d) => d.playerId)).toEqual([cit.id]);
  });
  it('sheriff shot kills mafia, guilt kills sheriff when shooting town', () => {
    const st = gameWith({ mafia: 2, sheriff: 1 }, 8, { sheriffShots: 2 });
    const sh = byRole(st, 'sheriff')[0];
    const [m1, m2] = byRole(st, 'mafia');
    submitNightAction(st, sh.id, 'sheriff', m1.id);
    submitNightAction(st, m1.id, 'mafia', null);
    submitNightAction(st, m2.id, 'mafia', null);
    let rep = resolveNight(st, 3000);
    expect(rep.deaths.map((d) => [d.playerId, d.cause])).toEqual([[m1.id, 'sheriff']]);
    advance(st, 4000); advance(st, 5000); advance(st, 6000); advance(st, 7000);
    const cit = byRole(st, 'citizen')[0];
    submitNightAction(st, sh.id, 'sheriff', cit.id);
    submitNightAction(st, m2.id, 'mafia', null);
    rep = resolveNight(st, 8000);
    expect(rep.deaths.map((d) => d.cause).sort()).toEqual(['guilt', 'sheriff']);
  });
  it('silencer silences; survivor vest saves', () => {
    const st = gameWith({ silencer: 1, survivor: 1 }, 6);
    const sil = byRole(st, 'silencer')[0];
    const sv = byRole(st, 'survivor')[0];
    const cit = byRole(st, 'citizen')[0];
    submitNightAction(st, sil.id, 'silencer', cit.id);
    submitNightAction(st, sil.id, 'mafia', sv.id);
    submitNightAction(st, sv.id, 'survivor', true);
    const rep = resolveNight(st, 3000);
    expect(rep.silenced).toBe(cit.id);
    expect(st.players.find((p) => p.id === cit.id)!.silenced).toBe(true);
    expect(rep.deaths.length).toBe(0);
    expect(sv.vestsLeft).toBe(1);
  });
});

describe('voting', () => {
  function toVoting(st: ReturnType<typeof gameWith>) {
    st.players.forEach((p) => getNightPrompts(st, p.id).forEach((pr) => pr.kind !== 'none' && submitNightAction(st, p.id, pr.kind, null)));
    advance(st, 3000); advance(st, 4000); advance(st, 5000);
    expect(st.phase).toBe('voting');
  }
  it('plurality eliminates top, overriding duplicate votes', () => {
    const st = gameWith({ mafia: 1 }, 5);
    toVoting(st);
    const [a, b, c, d, e] = st.players;
    castVote(st, a.id, b.id);
    castVote(st, a.id, c.id); // changed vote - only last counts
    castVote(st, b.id, c.id);
    castVote(st, d.id, null);
    castVote(st, e.id, c.id);
    const res = resolveVotes(st, 6000);
    expect(res.tally[c.id]).toBe(3);
    expect(res.votes.length).toBe(4);
    expect(res.eliminated).toBe(c.id);
    expect(c.alive).toBe(false);
  });
  it('tie -> no elimination by default; revote rule triggers revote', () => {
    const st = gameWith({ mafia: 1 }, 5, { tieRule: 'revote' });
    toVoting(st);
    const [a, b, c, d, e] = st.players;
    castVote(st, a.id, b.id);
    castVote(st, b.id, a.id);
    castVote(st, c.id, b.id);
    castVote(st, d.id, a.id);
    castVote(st, e.id, null);
    const res = resolveVotes(st, 6000);
    expect(res.revote).toBe(true);
    expect(st.phase).toBe('voting');
    expect(st.revoteCandidates?.sort()).toEqual([a.id, b.id].sort());
    expect(castVote(st, c.id, d.id)).toBeTruthy(); // not a candidate
    castVote(st, c.id, a.id);
    castVote(st, d.id, a.id);
    const res2 = resolveVotes(st, 7000);
    expect(res2.eliminated).toBe(a.id);
  });
  it('majority mode requires > half', () => {
    const st = gameWith({ mafia: 1 }, 6, { voteMode: 'majority' });
    toVoting(st);
    const [a, b, c, d, e, f] = st.players;
    castVote(st, a.id, b.id); castVote(st, c.id, b.id); castVote(st, d.id, b.id);
    castVote(st, e.id, null); castVote(st, f.id, null); castVote(st, b.id, null);
    expect(resolveVotes(st, 6000).eliminated).toBeNull(); // 3 of 6 is not > half
  });
  it('jester wins when voted out and keeps the game going', () => {
    const st = gameWith({ mafia: 1, jester: 1 }, 6);
    toVoting(st);
    const j = byRole(st, 'jester')[0];
    st.players.filter((p) => p.id !== j.id).forEach((p) => castVote(st, p.id, j.id));
    const res = resolveVotes(st, 6000);
    expect(res.jesterWin).toBe(true);
    expect(st.phase).toBe('voteResult');
    expect(st.winner).toBeNull();
  });
});

describe('win conditions', () => {
  it('town wins when mafia gone; mafia wins at parity; survivor shares win', () => {
    const st = gameWith({ mafia: 1, survivor: 1 }, 5);
    const m = byRole(st, 'mafia')[0];
    m.alive = false;
    const w = checkWin(st)!;
    expect(w.team).toBe('town');
    expect(w.winners).toContain(byRole(st, 'survivor')[0].id);
    m.alive = true;
    byRole(st, 'citizen').forEach((c) => (c.alive = false));
    expect(checkWin(st)!.team).toBe('mafia');
  });
});

describe('client view privacy', () => {
  it('hides other roles, shows mafia allies, shows own investigation only', () => {
    const st = gameWith({ mafia: 2, detective: 1 }, 7);
    const [m1, m2] = byRole(st, 'mafia');
    const det = byRole(st, 'detective')[0];
    const cit = byRole(st, 'citizen')[0];
    const vCit = buildView(st, cit.id);
    expect(vCit.players.filter((p) => p.role !== null).map((p) => p.id)).toEqual([cit.id]);
    const vM = buildView(st, m1.id);
    expect(vM.me!.allies).toEqual([m2.id]);
    expect(vM.players.find((p) => p.id === m2.id)!.role).toBe('mafia');
    expect(vM.players.find((p) => p.id === det.id)!.role).toBeNull();
    submitNightAction(st, det.id, 'detective', m1.id);
    submitNightAction(st, m1.id, 'mafia', null);
    submitNightAction(st, m2.id, 'mafia', null);
    resolveNight(st, 3000);
    expect(buildView(st, det.id).lastNight!.myInvestigation!.result).toBe('suspicious');
    expect(buildView(st, cit.id).lastNight!.myInvestigation).toBeNull();
    expect(buildView(st, cit.id).log.some((l) => l.text.includes('Investigation'))).toBe(false);
  });
  it('game over reveals everything', () => {
    const st = gameWith({ mafia: 1 }, 4);
    byRole(st, 'mafia')[0].alive = false;
    advance(st, 3000); // resolves night and ends
    expect(st.phase).toBe('gameOver');
    const v = buildView(st, st.players[0].id);
    expect(v.players.every((p) => p.role !== null)).toBe(true);
  });
});

describe('cupid, bomb, baker, crime scenes', () => {
  it('cupid binds lovers; a night kill takes the lover too, with a crime scene', () => {
    const st = gameWith({ mafia: 1, cupid: 1 }, 7, { map: 'hospital' });
    const cupid = byRole(st, 'cupid')[0];
    const mafia = byRole(st, 'mafia')[0];
    const [a, b] = byRole(st, 'citizen');
    expect(getNightPrompts(st, cupid.id)[0]).toMatchObject({ kind: 'cupid', pick: 2 });
    expect(submitNightAction(st, cupid.id, 'cupid', [a.id, a.id])).toBeTruthy();
    expect(submitNightAction(st, cupid.id, 'cupid', [a.id, b.id])).toBeNull();
    submitNightAction(st, mafia.id, 'mafia', a.id);
    const rep = resolveNight(st, 3000);
    expect(a.loverId).toBe(b.id);
    expect(rep.deaths.map((d) => [d.playerId, d.cause])).toEqual([[a.id, 'mafia'], [b.id, 'heartbreak']]);
    expect(rep.deaths[0].scene?.room).toBeTruthy();
    expect(st.map).toBe('hospital');
    expect(buildView(st, b.id).me!.loverId).toBe(a.id);
  });
  it('voting out a lover takes the other lover', () => {
    const st = gameWith({ mafia: 1, cupid: 1 }, 7);
    const cupid = byRole(st, 'cupid')[0];
    const [a, b] = byRole(st, 'citizen');
    submitNightAction(st, cupid.id, 'cupid', [a.id, b.id]);
    st.players.forEach((p) => getNightPrompts(st, p.id).forEach((pr) => pr.kind === 'mafia' && submitNightAction(st, p.id, 'mafia', null)));
    resolveNight(st, 3000);
    advance(st, 4000); advance(st, 5000);
    st.players.filter((p) => p.id !== a.id).forEach((p) => castVote(st, p.id, a.id));
    const res = resolveVotes(st, 6000);
    expect(res.eliminated).toBe(a.id);
    expect(res.extraDeaths).toEqual([{ playerId: b.id, cause: 'heartbreak', by: a.id }]);
    expect(b.alive).toBe(false);
  });
  it('bomb killed by mafia takes a mafia member; voted out takes a voter', () => {
    const st = gameWith({ mafia: 2, bomb: 1 }, 8);
    const bomb = byRole(st, 'bomb')[0];
    const [m1, m2] = byRole(st, 'mafia');
    submitNightAction(st, m1.id, 'mafia', bomb.id);
    submitNightAction(st, m2.id, 'mafia', bomb.id);
    const rep = resolveNight(st, 3000);
    expect(rep.deaths[0]).toMatchObject({ playerId: bomb.id, cause: 'mafia' });
    expect(rep.deaths[1].cause).toBe('bomb');
    expect([m1.id, m2.id]).toContain(rep.deaths[1].playerId);

    const st2 = gameWith({ mafia: 1, bomb: 1 }, 7);
    const bomb2 = byRole(st2, 'bomb')[0];
    st2.players.forEach((p) => getNightPrompts(st2, p.id).forEach((pr) => pr.kind === 'mafia' && submitNightAction(st2, p.id, 'mafia', null)));
    resolveNight(st2, 3000); advance(st2, 4000); advance(st2, 5000);
    const voters = st2.players.filter((p) => p.id !== bomb2.id).slice(0, 4);
    voters.forEach((p) => castVote(st2, p.id, bomb2.id));
    const res = resolveVotes(st2, 6000);
    expect(res.extraDeaths.length).toBe(1);
    expect(res.extraDeaths[0].cause).toBe('bomb');
    expect(voters.map((v) => v.id)).toContain(res.extraDeaths[0].playerId);
  });
  it('baker bread doubles a vote the next day', () => {
    const st = gameWith({ mafia: 1, baker: 1 }, 6);
    const baker = byRole(st, 'baker')[0];
    const [a, b] = byRole(st, 'citizen');
    submitNightAction(st, baker.id, 'baker', a.id);
    st.players.forEach((p) => getNightPrompts(st, p.id).forEach((pr) => pr.kind === 'mafia' && submitNightAction(st, p.id, 'mafia', null)));
    const rep = resolveNight(st, 3000);
    expect(rep.bread).toEqual([a.id]);
    advance(st, 4000); advance(st, 5000);
    castVote(st, a.id, b.id);
    expect(resolveVotes(st, 6000).tally[b.id]).toBe(2);
    expect(st.bread).toEqual([]);
  });
});

describe('trial and last words', () => {
  function toVoting(st: ReturnType<typeof gameWith>) {
    st.players.forEach((p) => getNightPrompts(st, p.id).forEach((pr) => pr.kind !== 'none' && submitNightAction(st, p.id, pr.kind, null)));
    advance(st, 3000); advance(st, 4000); advance(st, 5000);
  }
  it('top-voted player goes on trial; guilty majority executes, otherwise spared', () => {
    const st = gameWith({ mafia: 1 }, 6, { trial: true });
    toVoting(st);
    const [a, b, c, d, e, f] = st.players;
    [b, c, d, e].forEach((p) => castVote(st, p.id, a.id));
    resolveVotes(st, 6000);
    expect(st.phase).toBe('defense');
    expect(a.alive).toBe(true);
    beginJudgment(st, 7000);
    expect(castJudgment(st, a.id, 'innocent')).toBeTruthy(); // accused can't judge
    castJudgment(st, b.id, 'guilty'); castJudgment(st, c.id, 'innocent'); castJudgment(st, d.id, 'innocent');
    const res = resolveJudgment(st, 8000);
    expect(res.trial).toMatchObject({ accused: a.id, guilty: 1, innocent: 2, spared: true });
    expect(res.eliminated).toBeNull();
    expect(a.alive).toBe(true);
    expect(st.phase).toBe('voteResult');

    advance(st, 9000); // night 2
    st.players.forEach((p) => p.alive && getNightPrompts(st, p.id).forEach((pr) => pr.kind !== 'none' && submitNightAction(st, p.id, pr.kind, null)));
    advance(st, 10000); advance(st, 11000); advance(st, 12000);
    const alive = st.players.filter((p) => p.alive);
    alive.filter((p) => p.id !== b.id).forEach((p) => castVote(st, p.id, b.id));
    resolveVotes(st, 13000);
    advance(st, 14000); // defense -> judgment
    expect(st.phase).toBe('judgment');
    alive.filter((p) => p.id !== b.id).forEach((p) => castJudgment(st, p.id, 'guilty'));
    const r2 = resolveJudgment(st, 15000);
    expect(r2.eliminated).toBe(b.id);
    expect(b.alive).toBe(false);
  });
  it('dead players can leave last words once, the same day they died', () => {
    const st = gameWith({ mafia: 1 }, 5);
    const m = byRole(st, 'mafia')[0];
    const victim = byRole(st, 'citizen')[0];
    submitNightAction(st, m.id, 'mafia', victim.id);
    resolveNight(st, 3000);
    expect(canLeaveLastWords(st, victim.id)).toBe(true);
    expect(canLeaveLastWords(st, m.id)).toBe(false);
    expect(submitLastWords(st, victim.id, '  It was   the quiet one.  ', 3500)).toBeNull();
    expect(st.lastWords[victim.id]).toBe('It was the quiet one.');
    expect(submitLastWords(st, victim.id, 'again', 3600)).toBeTruthy();
    expect(buildView(st, m.id).players.find((p) => p.id === victim.id)!.lastWords).toBe('It was the quiet one.');
    expect(st.log.some((l) => l.text === `Last words of ${victim.name}: "It was the quiet one."`)).toBe(true);
  });
});

describe('hard mode', () => {
  it('needs 10 players, gives everyone a unique public trait', () => {
    expect(validateRoles({ ...defaultSettings(9), hardMode: true }, 9)).toMatch(/Hard mode/);
    const st = gameWith({ mafia: 2, detective: 1 }, 12, { hardMode: true });
    const traits = st.players.map((p) => p.trait);
    expect(new Set(traits).size).toBe(12);
    expect(buildView(st, st.players[0].id).players.every((p) => !!p.trait)).toBe(true);
  });
  it('detective gets three clue words, exactly one pointing to a living Mafia member', () => {
    for (let seed = 0; seed < 25; seed++) {
      const s = { ...defaultSettings(12), roles: { mafia: 2, detective: 1 }, randomEvents: false, trial: false, hardMode: true };
      const lobby = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: i, isHost: i === 0 }));
      const st = createGame(lobby, s, 1000 + seed, 0);
      st.players.forEach((p) => ackReveal(st, p.id));
      advance(st, 1);
      const det = st.players.find((p) => p.role === 'detective')!;
      expect(getNightPrompts(st, det.id)[0].kind).toBe('none');
      st.players.filter((p) => p.role === 'mafia').forEach((m) => submitNightAction(st, m.id, 'mafia', null));
      const rep = resolveNight(st, 2);
      const words = rep.clues[det.id];
      expect(words).toHaveLength(3);
      const owners = words.map((w) => st.players.find((p) => TRAITS.find((t) => t.id === p.trait)!.words.includes(w))!);
      expect(new Set(owners.map((o) => o.id)).size).toBe(3);
      expect(owners.filter((o) => o.role === 'mafia')).toHaveLength(1);
      expect(owners.some((o) => o.id === det.id)).toBe(false);
      const v = buildView(st, det.id);
      expect(v.lastNight!.myClues).toEqual(words);
      expect(v.me!.notebook[0].clues).toEqual(words);
      expect(buildView(st, owners[0].id === det.id ? owners[1].id : st.players.find((p) => p.role === 'citizen')!.id).lastNight!.myClues).toBeNull();
    }
  });
  it('trait clue words are unique across traits', () => {
    const all = TRAITS.flatMap((t) => t.words);
    expect(new Set(all).size).toBe(all.length);
    expect(TRAITS.length).toBeGreaterThanOrEqual(36);
  });
});
