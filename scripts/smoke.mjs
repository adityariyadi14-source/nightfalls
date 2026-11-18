// Protocol-level smoke test: 5 clients play a full game against the real server.
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const PORT = 8790;
const srv = spawn('node_modules/.bin/tsx', ['server/index.ts'], { env: { ...process.env, PORT: String(PORT), DATA_FILE: '/tmp/nf-smoke.json' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => srv.stdout.on('data', (d) => String(d).includes('listening') && r()));

const assert = (c, m) => { if (!c) { console.error('ASSERT FAIL:', m); srv.kill(); process.exit(1); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Bot {
  constructor(name) { this.name = name; this.room = null; this.errors = []; this.history = null; }
  connect() {
    return new Promise((res) => {
      this.ws = new WebSocket(`ws://localhost:${PORT}/ws`);
      this.ws.on('open', () => this.send({ t: 'hello', guestId: this.guestId ?? null, secret: this.secret ?? null, name: this.name, avatar: 1 }));
      this.ws.on('error', () => {});
      this.ws.on('message', (raw) => {
        const m = JSON.parse(String(raw));
        if (m.t === 'welcome') { this.guestId = m.guestId; this.secret = m.secret; res(); }
        if (m.t === 'room') this.room = m.room;
        if (m.t === 'error') this.errors.push(m.message);
        if (m.t === 'history') this.history = m.matches;
        if (m.t === 'left') this.room = null;
        if (m.t === 'account') this.account = m;
      });
    });
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  get game() { return this.room?.game; }
  get me() { return this.game?.me; }
}

const bots = ['Ava', 'Ben', 'Cy', 'Dee', 'Eli'].map((n) => new Bot(n));
for (const b of bots) await b.connect();
bots[0].send({ t: 'createRoom', isPublic: false, settings: { roles: { mafia: 1, detective: 1, doctor: 1 }, randomEvents: false, nightSeconds: 15, discussionSeconds: 20, votingSeconds: 15, revealSeconds: 5 } });
await sleep(200);
assert(bots[0].room && bots[0].room.code.length === 5, 'room created');
const code = bots[0].room.code;
for (const b of bots.slice(1)) b.send({ t: 'joinRoom', code });
await sleep(300);
assert(bots.every((b) => b.room?.players.length === 5), 'all joined');
// Non-host cannot start
bots[1].send({ t: 'startGame' });
await sleep(100);
assert(bots[1].errors.some((e) => e.includes('host')), 'non-host start rejected');
bots[0].send({ t: 'startGame' });
await sleep(300);
assert(bots.every((b) => b.game?.phase === 'roleReveal'), 'role reveal phase');
// Privacy: each bot sees only its own role
for (const b of bots) {
  const visible = b.game.players.filter((p) => p.role !== null);
  assert(visible.length === 1 && visible[0].id === b.guestId, `${b.name} sees only own role`);
}
const roles = Object.fromEntries(bots.map((b) => [b.name, b.me.role]));
console.log('roles:', roles);
for (const b of bots) b.send({ t: 'ackReveal' });
await sleep(700);
assert(bots.every((b) => b.game.phase === 'night'), 'night 1 after all acks');

// Reconnect test: Ben drops and comes back with same identity
const ben = bots[1];
ben.ws.close();
await sleep(300);
assert(bots[0].game.players.find((p) => p.id === ben.guestId).connected === false, 'Ben shown disconnected');
await ben.connect();
await sleep(300);
assert(ben.room?.code === code && ben.game?.phase === 'night', 'Ben reconnected into game');
assert(bots[0].game.players.find((p) => p.id === ben.guestId).connected === true, 'Ben shown connected');

// Night actions: mafia kills a citizen, doctor protects someone else, detective investigates mafia.
const mafia = bots.find((b) => b.me.role === 'mafia');
const doctor = bots.find((b) => b.me.role === 'doctor');
const detective = bots.find((b) => b.me.role === 'detective');
const citizens = bots.filter((b) => b.me.role === 'citizen');
assert(mafia && doctor && detective && citizens.length === 2, 'roles dealt');
// Invalid: citizen tries a night action
citizens[0].send({ t: 'nightAction', kind: 'mafia', target: doctor.guestId });
await sleep(100);
assert(citizens[0].errors.at(-1)?.includes('ability'), 'citizen cannot act');
mafia.send({ t: 'nightAction', kind: 'mafia', target: citizens[0].guestId });
doctor.send({ t: 'nightAction', kind: 'doctor', target: citizens[1].guestId });
detective.send({ t: 'nightAction', kind: 'detective', target: mafia.guestId });
await sleep(800);
assert(bots.every((b) => b.game.phase === 'dayAnnounce'), 'day announce after all actions: ' + bots.map((b) => b.game.phase));
assert(bots[0].game.players.find((p) => p.id === citizens[0].guestId).alive === false, 'citizen 0 died');
assert(detective.game.lastNight.myInvestigation?.result === 'suspicious', 'detective result private');
assert(doctor.game.lastNight.myInvestigation === null, 'doctor sees no investigation');
// Dead player is spectator: sees all roles
assert(citizens[0].game.players.every((p) => p.role !== null), 'dead sees all roles');
// Last words: the night victim leaves one message, visible to everyone
citizens[0].send({ t: 'lastWords', text: 'Watch the quiet one.' });
await sleep(200);
assert(bots[0].game.players.find((p) => p.id === citizens[0].guestId).lastWords === 'Watch the quiet one.', 'last words visible to others');
citizens[0].send({ t: 'lastWords', text: 'again' });
await sleep(150);
assert(citizens[0].errors.at(-1)?.includes('last words'), 'last words only once');
// Host skips announce -> discussion
bots[0].send({ t: 'skipPhase' });
await sleep(300);
assert(bots[0].game.phase === 'discussion', 'discussion');
// Chat: dead can't talk publicly
citizens[0].send({ t: 'chat', text: 'boo', channel: 'public' });
detective.send({ t: 'chat', text: `${mafia.name} is suspicious!`, channel: 'public' });
await sleep(200);
assert(citizens[0].errors.at(-1)?.includes('dead'), 'dead cannot chat publicly');
assert(bots[0].game.chat.some((c) => c.text.includes('suspicious')), 'public chat delivered');
bots[0].send({ t: 'skipPhase' });
await sleep(300);
assert(bots[0].game.phase === 'voting', 'voting');
// Dead player cannot vote; duplicate votes override
citizens[0].send({ t: 'vote', target: mafia.guestId });
await sleep(100);
assert(citizens[0].errors.at(-1)?.includes('cannot vote'), 'dead cannot vote');
for (const b of [doctor, detective, citizens[1]]) b.send({ t: 'vote', target: mafia.guestId });
mafia.send({ t: 'vote', target: detective.guestId });
mafia.send({ t: 'vote', target: doctor.guestId });
await sleep(800);
assert(bots[0].game.phase === 'defense' && bots[0].game.trial?.accused === mafia.guestId, 'mafia put on trial: ' + bots[0].game.phase);
// Only the accused may speak during the defense
detective.send({ t: 'chat', text: 'guilty!', channel: 'public' });
mafia.send({ t: 'chat', text: 'I am innocent, I swear.', channel: 'public' });
await sleep(200);
assert(detective.errors.at(-1)?.includes('accused'), 'bystander cannot speak in defense');
assert(bots[0].game.chat.some((c) => c.text.includes('I swear')), 'accused can speak in defense');
bots[0].send({ t: 'skipPhase' });
await sleep(300);
assert(bots[0].game.phase === 'judgment', 'judgment phase');
mafia.send({ t: 'judge', verdict: 'innocent' });
await sleep(150);
assert(mafia.errors.at(-1)?.includes('accused'), 'accused cannot judge');
for (const b of [doctor, detective, citizens[1]]) b.send({ t: 'judge', verdict: 'guilty' });
await sleep(800);
const g = bots[0].game;
assert(g.phase === 'gameOver', 'game over after mafia executed, phase=' + g.phase);
assert(g.lastVote.trial?.guilty === 3 && g.lastVote.trial?.spared === false, 'trial tally recorded');
assert(g.winner.team === 'town', 'town wins');
assert(g.lastVote.tally[mafia.guestId] === 3 && g.lastVote.votes.length === 4, 'tally correct & no duplicate votes');
assert(bots[0].room.status === 'ended', 'room ended');
bots[0].send({ t: 'getHistory' });
await sleep(200);
assert(bots[0].history?.length >= 1 && bots[0].history[0].winner === 'town', 'match history recorded');
bots[0].send({ t: 'playAgain' });
await sleep(200);
assert(bots[0].room.status === 'lobby' && bots[0].room.game === null, 'back to lobby');
// Accounts: register Ava, log in from a brand-new device, history follows.
bots[0].send({ t: 'register', username: 'ava_test', password: 'hunter22' });
await sleep(300);
assert(bots[0].account?.username === 'ava_test', 'account registered');
const fresh = new Bot('NewDevice');
await fresh.connect();
assert(fresh.guestId !== bots[0].guestId, 'fresh device has its own guest id');
fresh.send({ t: 'login', username: 'ava_test', password: 'wrong-pass' });
await sleep(300);
assert(fresh.errors.at(-1)?.includes('Wrong'), 'bad password rejected');
fresh.send({ t: 'login', username: 'AVA_TEST', password: 'hunter22' });
await sleep(300);
assert(fresh.account?.guestId === bots[0].guestId, 'login returns account identity');
fresh.guestId = fresh.account.guestId; fresh.secret = fresh.account.secret;
await sleep(200);
await fresh.connect();
fresh.send({ t: 'getHistory' });
await sleep(300);
assert(fresh.history?.length >= 1, 'history available after login on new device');
// Impersonation: knowing a guest id without its secret yields a new identity
const imposter = new Bot('Imposter');
imposter.guestId = bots[1].guestId; imposter.secret = 'not-the-secret-xxxxxx';
await imposter.connect();
assert(imposter.guestId !== bots[1].guestId, 'guest id without secret cannot be hijacked');
console.log('SMOKE OK');
srv.kill();
process.exit(0);
