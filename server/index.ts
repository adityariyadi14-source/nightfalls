import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Room, send, type Client } from './room';
import { Store } from './store';
import { randomId, roomCode } from '../src/engine';
import type { C2S } from '../src/shared/protocol';

const PORT = Number(process.env.PORT ?? 8787);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const store = new Store(process.env.DATA_FILE ?? path.resolve(__dirname, 'data/store.json'));

const rooms = new Map<string, Room>();
const clients = new Map<WebSocket, Client>();
const roomByPlayer = new Map<string, string>();

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, clients: clients.size }));
    return;
  }
  if (url.pathname === '/api/rooms') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(publicRooms()));
    return;
  }
  // Static hosting of the built client (production)
  if (fs.existsSync(DIST)) {
    let file = path.join(DIST, decodeURIComponent(url.pathname));
    if (!file.startsWith(DIST)) file = path.join(DIST, 'index.html');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(404);
  res.end('Nightfall server. Run `npm run dev` for the client.');
});

const wss = new WebSocketServer({ server, path: '/ws' });

function publicRooms() {
  return [...rooms.values()].filter((r) => r.isPublic && r.status === 'lobby' && r.seats.length < r.publicInfo.maxPlayers).map((r) => r.publicInfo);
}

/** Accepts only small inline PNG/JPEG data URLs as profile photos. */
function cleanPhoto(p: unknown): string | undefined {
  if (typeof p !== 'string' || p.length > 24000) return undefined;
  return /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(p) ? p : undefined;
}

function cleanName(n: unknown) {
  const s = String(n ?? '').replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().slice(0, 18);
  return s || 'Player';
}

function newRoomCode() {
  let code = roomCode();
  while (rooms.has(code)) code = roomCode();
  return code;
}

function getRoom(c: Client) {
  return c.roomCode ? rooms.get(c.roomCode) ?? null : null;
}

function joinRoom(c: Client, room: Room) {
  const err = room.addPlayer(c);
  if (err) return err;
  c.roomCode = room.code;
  roomByPlayer.set(c.guestId, room.code);
  room.broadcast();
  return null;
}

function leaveRoom(c: Client, permanent: boolean) {
  const room = getRoom(c);
  if (!room) return;
  if (permanent) {
    room.removeSeat(c.guestId, 'left');
    roomByPlayer.delete(c.guestId);
  } else {
    room.markDisconnected(c.guestId);
  }
  c.roomCode = null;
  if (room.seats.length === 0) rooms.delete(room.code);
  else room.broadcast();
}

wss.on('connection', (ws) => {
  let client: Client | null = null;
  (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
  ws.on('pong', () => ((ws as WebSocket & { isAlive?: boolean }).isAlive = true));

  ws.on('message', (raw) => {
    let msg: C2S;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    try {
      if (msg.t === 'hello') {
        let guestId = typeof msg.guestId === 'string' && /^[a-z0-9]{6,24}$/.test(msg.guestId) ? msg.guestId : null;
        let secret = typeof msg.secret === 'string' ? msg.secret : null;
        const known = guestId ? store.getIdentity(guestId) : undefined;
        if (!guestId || (known && known.secret !== secret)) {
          guestId = randomId(12);
          secret = randomId(24);
        } else if (!known) {
          secret = secret && secret.length >= 16 ? secret : randomId(24);
        }
        const name = cleanName(msg.name);
        const avatar = Math.max(0, Math.min(23, Number(msg.avatar) || 0));
        store.upsertIdentity(guestId, secret!, name, avatar);
        // Replace any older socket for the same identity
        for (const [otherWs, other] of clients) {
          if (other.guestId === guestId && otherWs !== ws) {
            clients.delete(otherWs);
            try { otherWs.close(4000, 'Replaced'); } catch { /* noop */ }
          }
        }
        client = { ws, guestId, name, avatar, photo: cleanPhoto(msg.photo), roomCode: null, alive: true };
        clients.set(ws, client);
        // Auto-reconnect to a room the player was in
        const prev = roomByPlayer.get(guestId);
        const room = prev ? rooms.get(prev) : undefined;
        if (room && room.seat(guestId)) {
          room.reconnect(client);
          client.roomCode = room.code;
          send(ws, { t: 'welcome', guestId, secret: secret!, roomCode: room.code, username: store.accountForGuest(guestId) });
          room.systemToast(`${name} reconnected.`, 'success', guestId);
          room.broadcast();
        } else {
          roomByPlayer.delete(guestId);
          send(ws, { t: 'welcome', guestId, secret: secret!, roomCode: null, username: store.accountForGuest(guestId) });
        }
        return;
      }
      if (!client) {
        send(ws, { t: 'error', message: 'Say hello first.' });
        return;
      }
      const c = client;
      const room = getRoom(c);
      const fail = (message: string) => send(ws, { t: 'error', message });
      switch (msg.t) {
        case 'ping':
          send(ws, { t: 'pong', ts: msg.ts, now: Date.now() });
          break;
        case 'listRooms':
          send(ws, { t: 'rooms', rooms: publicRooms() });
          break;
        case 'createRoom': {
          if (room) leaveRoom(c, true);
          const r = new Room(newRoomCode(), !!msg.isPublic, c.guestId, msg.settings, (m) => store.addMatch(m));
          rooms.set(r.code, r);
          const err = joinRoom(c, r);
          if (err) fail(err);
          break;
        }
        case 'joinRoom': {
          const code = String(msg.code ?? '').toUpperCase().trim();
          const r = rooms.get(code);
          if (!r) return fail('Room not found. Check the code and try again.');
          if (room && room !== r) leaveRoom(c, true);
          const err = joinRoom(c, r);
          if (err) fail(err);
          break;
        }
        case 'quickJoin': {
          if (room) leaveRoom(c, true);
          const candidates = [...rooms.values()].filter((r) => r.isPublic && r.status === 'lobby' && r.seats.length < 15);
          candidates.sort((a, b) => b.seats.length - a.seats.length);
          let r = candidates[0];
          if (!r) {
            r = new Room(newRoomCode(), true, c.guestId, undefined, (m) => store.addMatch(m));
            rooms.set(r.code, r);
          }
          const err = joinRoom(c, r);
          if (err) fail(err);
          break;
        }
        case 'leaveRoom':
          leaveRoom(c, true);
          send(ws, { t: 'left' });
          break;
        case 'updateProfile': {
          c.name = cleanName(msg.name);
          c.avatar = Math.max(0, Math.min(23, Number(msg.avatar) || 0));
          c.photo = cleanPhoto(msg.photo);
          store.upsertIdentity(c.guestId, store.getIdentity(c.guestId)?.secret ?? randomId(24), c.name, c.avatar);
          if (room) {
            room.updateProfile(c.guestId, c.name, c.avatar, c.photo);
            room.broadcast();
          }
          break;
        }
        case 'register': {
          const username = String(msg.username ?? '').trim();
          const password = String(msg.password ?? '');
          if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return fail('Usernames are 3–20 letters, numbers or underscores.');
          if (password.length < 6 || password.length > 100) return fail('Passwords need at least 6 characters.');
          const err = store.register(username, password, c.guestId);
          if (err) return fail(err);
          const id = store.getIdentity(c.guestId)!;
          send(ws, { t: 'account', username, guestId: c.guestId, secret: id.secret });
          send(ws, { t: 'toast', text: `Account ${username} created. Log in from any device.`, kind: 'success' });
          break;
        }
        case 'login': {
          const res = store.login(String(msg.username ?? '').trim(), String(msg.password ?? ''));
          if (!res) return fail('Wrong username or password.');
          if (room) leaveRoom(c, true);
          send(ws, { t: 'account', username: res.username, guestId: res.guestId, secret: res.identity.secret, name: res.identity.name, avatar: res.identity.avatar });
          // The client reconnects with the account identity.
          setTimeout(() => ws.close(4001, 'Switching identity'), 50);
          break;
        }
        case 'logout': {
          if (room) leaveRoom(c, true);
          send(ws, { t: 'account', username: null, guestId: '', secret: '' });
          setTimeout(() => ws.close(4001, 'Switching identity'), 50);
          break;
        }
        case 'getHistory':
          send(ws, { t: 'history', matches: store.historyFor(c.guestId) });
          break;
        default: {
          if (!room) return fail('You are not in a room.');
          let err: string | null = null;
          switch (msg.t) {
            case 'updateSettings': err = room.updateSettings(c.guestId, msg.settings ?? {}); break;
            case 'kick': err = room.kick(c.guestId, String(msg.playerId)); break;
            case 'startGame': err = room.startGame(c.guestId); break;
            case 'ackReveal': room.ackReveal(c.guestId); break;
            case 'nightAction': err = room.nightAction(c.guestId, msg.kind, msg.target); break;
            case 'vote': err = room.vote(c.guestId, msg.target === null ? null : String(msg.target)); break;
            case 'judge': err = room.judge(c.guestId, msg.verdict); break;
            case 'lastWords': err = room.lastWords(c.guestId, String(msg.text ?? '')); break;
            case 'chat': err = room.chat(c.guestId, msg.text, msg.channel); break;
            case 'skipPhase': err = room.skipPhase(c.guestId); break;
            case 'playAgain': err = room.playAgain(c.guestId); break;
          }
          if (err) fail(err);
          // Immediate broadcast for responsiveness; the tick loop also catches changes.
          if (room.tick(Date.now())) room.broadcast();
        }
      }
    } catch (e) {
      console.error('[ws] error handling message', msg, e);
      send(ws, { t: 'error', message: 'Something went wrong on the server.' });
    }
  });

  ws.on('close', () => {
    if (client) {
      clients.delete(ws);
      const room = getRoom(client);
      if (room && room.seat(client.guestId)?.socket === ws) leaveRoom(client, false);
    }
  });
});

// Game loop: timers & auto-advance.
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.tick(now)) room.broadcast();
    if (room.isEmpty && now - room.lastActivity > 60_000) rooms.delete(room.code);
  }
}, 500);

// Liveness pings
setInterval(() => {
  for (const ws of wss.clients) {
    const w = ws as WebSocket & { isAlive?: boolean };
    if (w.isAlive === false) return w.terminate();
    w.isAlive = false;
    w.ping();
  }
}, 30_000);

server.listen(PORT, () => console.log(`[nightfall] server listening on http://localhost:${PORT}`));
