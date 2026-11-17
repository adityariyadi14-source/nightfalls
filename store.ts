import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { MatchRecord } from '../src/shared/protocol';

interface Identity {
  secret: string;
  name: string;
  avatar: number;
  createdAt: number;
}

interface Account {
  username: string;
  salt: string;
  hash: string;
  guestId: string;
  createdAt: number;
}

interface StoreData {
  identities: Record<string, Identity>;
  matches: MatchRecord[];
  accounts?: Record<string, Account>; // key: lowercased username
}

/** Tiny JSON-file persistence for guest identities and match history. */
export class Store {
  private data: StoreData = { identities: {}, matches: [] };
  private timer: NodeJS.Timeout | null = null;

  constructor(private file: string) {
    try {
      if (fs.existsSync(file)) this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.warn('[store] could not read store, starting fresh', e);
    }
  }

  private flush() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.writeFileSync(this.file, JSON.stringify(this.data));
      } catch (e) {
        console.warn('[store] write failed', e);
      }
    }, 500);
  }

  getIdentity(id: string) {
    return this.data.identities[id];
  }

  upsertIdentity(id: string, secret: string, name: string, avatar: number) {
    const existing = this.data.identities[id];
    this.data.identities[id] = { secret, name, avatar, createdAt: existing?.createdAt ?? Date.now() };
    this.flush();
  }

  addMatch(m: MatchRecord) {
    this.data.matches.push(m);
    if (this.data.matches.length > 5000) this.data.matches = this.data.matches.slice(-5000);
    this.flush();
  }

  // ------------------------------------------------------------ accounts
  private hashPw(password: string, salt: string) {
    return crypto.scryptSync(password, salt, 32).toString('hex');
  }

  accountForGuest(guestId: string): string | null {
    const a = Object.values(this.data.accounts ?? {}).find((x) => x.guestId === guestId);
    return a ? a.username : null;
  }

  register(username: string, password: string, guestId: string): string | null {
    this.data.accounts ??= {};
    const key = username.toLowerCase();
    if (this.data.accounts[key]) return 'That username is taken.';
    if (this.accountForGuest(guestId)) return 'This profile already has an account. Log out first.';
    const salt = crypto.randomBytes(16).toString('hex');
    this.data.accounts[key] = { username, salt, hash: this.hashPw(password, salt), guestId, createdAt: Date.now() };
    this.flush();
    return null;
  }

  /** Returns the account's guest identity when the password matches. */
  login(username: string, password: string): { username: string; guestId: string; identity: Identity } | null {
    const a = this.data.accounts?.[username.toLowerCase()];
    if (!a) return null;
    const h = this.hashPw(password, a.salt);
    if (!crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(a.hash, 'hex'))) return null;
    const identity = this.data.identities[a.guestId];
    if (!identity) return null;
    return { username: a.username, guestId: a.guestId, identity };
  }

  historyFor(playerId: string): MatchRecord[] {
    return this.data.matches.filter((m) => m.players.some((p) => p.id === playerId)).slice(-100).reverse();
  }
}
