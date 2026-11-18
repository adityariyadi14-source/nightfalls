import { useSyncExternalStore } from 'react';
import type { C2S, MatchRecord, PublicRoomInfo, RoomView, S2C } from '../../shared/protocol';
import { getPrefs, setPrefs } from '../lib/prefs';
import { toast } from '../lib/toast';
import { ONLINE_AVAILABLE } from '../lib/env';

export type ConnStatus = 'offline' | 'connecting' | 'online';

interface OnlineState {
  status: ConnStatus;
  room: RoomView | null;
  rooms: PublicRoomInfo[];
  history: MatchRecord[] | null;
  clockOffset: number; // serverNow - Date.now()
  guestId: string | null;
  username: string | null;
}

let state: OnlineState = { status: 'offline', room: null, rooms: [], history: null, clockOffset: 0, guestId: null, username: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<OnlineState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let ws: WebSocket | null = null;
let retry = 0;
let wanted = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const custom = (import.meta as unknown as { env: Record<string, string | undefined> }).env?.VITE_WS_URL;
  return custom || `${proto}://${location.host}/ws`;
}

export function connect() {
  if (!ONLINE_AVAILABLE) return;
  wanted = true;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  set({ status: 'connecting' });
  const sock = new WebSocket(wsUrl());
  ws = sock;
  sock.onopen = () => {
    retry = 0;
    const p = getPrefs();
    send({ t: 'hello', guestId: p.guestId, secret: p.secret, name: p.name, avatar: p.avatar, photo: p.photo ?? null });
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => send({ t: 'ping', ts: Date.now() }), 10_000);
    send({ t: 'ping', ts: Date.now() });
  };
  sock.onmessage = (ev) => {
    let msg: S2C;
    try { msg = JSON.parse(ev.data); } catch { return; }
    handle(msg);
  };
  sock.onclose = (ev) => {
    if (ws !== sock) return;
    ws = null;
    if (pingTimer) clearInterval(pingTimer);
    set({ status: 'offline' });
    if (ev.code === 4000) {
      // Another tab or device took over this identity; don't fight over it.
      wanted = false;
      toast('You connected from another tab or device. This one is now offline.', 'warn', 6000);
      return;
    }
    if (wanted) {
      const delay = ev.code === 4001 ? 50 : Math.min(8000, 500 * 2 ** retry++);
      reconnectTimer = setTimeout(connect, delay);
    }
  };
  sock.onerror = () => sock.close();
}

export function disconnect() {
  wanted = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
  set({ status: 'offline', room: null });
}

export function send(msg: C2S) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  else if (msg.t !== 'ping' && ONLINE_AVAILABLE) toast('Not connected to the server yet.', 'warn');
}

function handle(msg: S2C) {
  switch (msg.t) {
    case 'welcome':
      setPrefs({ guestId: msg.guestId, secret: msg.secret });
      set({ status: 'online', guestId: msg.guestId, username: msg.username });
      if (msg.roomCode) toast('Reconnected to your game.', 'success');
      break;
    case 'account':
      if (msg.username) {
        setPrefs({ guestId: msg.guestId, secret: msg.secret, ...(msg.name ? { name: msg.name } : {}), ...(msg.avatar !== undefined ? { avatar: msg.avatar } : {}) });
        set({ username: msg.username, guestId: msg.guestId });
      } else {
        // logout: forget the identity, a fresh guest is issued on reconnect
        setPrefs({ guestId: null, secret: null });
        set({ username: null, room: null });
      }
      break;
    case 'room':
      set({ room: msg.room, clockOffset: msg.room.serverNow - Date.now() });
      break;
    case 'left':
      set({ room: null });
      break;
    case 'rooms':
      set({ rooms: msg.rooms });
      break;
    case 'history':
      set({ history: msg.matches });
      break;
    case 'error':
      toast(msg.message, 'error');
      break;
    case 'toast':
      toast(msg.text, msg.kind);
      break;
    case 'pong': {
      const rtt = Date.now() - msg.ts;
      set({ clockOffset: msg.now + rtt / 2 - Date.now() });
      break;
    }
  }
}

export function useOnline() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );
}

export function clearRoom() {
  set({ room: null });
}
