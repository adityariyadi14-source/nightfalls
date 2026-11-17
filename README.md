# Nightfall: a social deduction game

Nightfall is a Mafia/Werewolf-style game with real-time online rooms and offline pass-and-play.

- **Online:** private rooms with 5-letter codes, public matchmaking, 4–15 players, live sync, connection status and automatic reconnects.
- **Local:** one device, 4–36 players, private pass-and-play screens, fully offline. The game state is saved after every action.
- **Roles:** Citizen, Detective, Doctor, Bodyguard, Sheriff, Cupid, Baker, Bomb, Mafia, Godfather, Silencer, Jester and Survivor. The host picks how many of each.
  - **Cupid** binds two lovers on night 1. If one dies, at night or by vote, the other dies of heartbreak.
  - **Bomb** explodes when killed: a Mafia kill takes a Mafia member with it, a vote takes one of the voters.
  - **Baker** gives bread each night. The holder's vote counts double the next day, and everyone sees who got it.
- **Maps:** Village, House, Hospital and Villa (or random). Every night death gets a crime-scene report: room, method, time of death and a clue.
- **Languages:** English and Bahasa Indonesia, switchable any time. Each device renders the game log in its own language.
- **Trial:** the top-voted player defends themselves, then everyone else votes guilty or not guilty.
- **Last words:** the dead leave one final message, shown on their case file or verdict.
- **Night tasks:** players with no ability do small decoy tasks, so nobody can tell who has a role.
- **Hard mode (10+ players):** every player has a public trait. The Detective gets three clue words each night, hinting at three players, exactly one of whom is Mafia. The Detective keeps a private notebook of every finding.
- **Profiles:** a Resident ID card with your own photo, optionally pixelated. Accounts can sign in on any device.
- **Online effects:** your screen falls asleep while others act at night, and a full-screen glitch-and-blood sequence plays when you die.

Hosting guide (Bahasa Indonesia): see `HOSTING.md`. A `Dockerfile` and a Render blueprint (`render.yaml`) are included.
- **Rules:** configurable timers, plurality or majority voting, three tie-break rules, random events, five map themes, procedural music and sound, and match statistics.

## Run it

```bash
npm install
npm run dev
```

This starts the game server on port 8787 and the web client on http://localhost:5173. Vite proxies `/ws` and `/api` to the server, so other devices on your network can join at `http://<your-ip>:5173`.

Production build, served by the game server on one port:

```bash
npm run build && npm start
```

Set `PORT` to change the port and `DATA_FILE` to choose where accounts and match history are stored. The default is `server/data/store.json`.

## Tests

```bash
npm test          # engine unit tests: roles, night resolution, voting, win conditions, privacy
npm run smoke     # 5 WebSocket clients play a full game against the real server, plus accounts
npm run e2e       # 5 Chromium browsers play online through the UI, then a full local game
npm run build:artifact  # single-file pass & play edition for claude.ai artifacts
```

## Architecture

```
src/engine/      Pure TypeScript rules engine, shared by server and browser
  game.ts        State machine: setup, night actions and resolution, voting, win checks
  view.ts        Builds the per-player view. All secrecy is enforced here.
server/          Node + ws authoritative server
  room.ts        Room lifecycle, validation, timers, reconnection
  index.ts       WebSocket protocol, matchmaking, static hosting
  store.ts       JSON persistence for guest identities, accounts and match history
src/client/      React + Tailwind + Framer Motion UI
  game/          Phase screens shared by online and local modes
  local/         Offline pass-and-play controller running the same engine
  online/        WebSocket client with reconnect and clock sync
```

**Server-authoritative play.** Clients only send intents such as "vote for X". The server validates each one against the engine, which checks phase, liveness, ability and target. Each player then gets a filtered view. Other players' roles, private investigation results, Mafia chat and Mafia targets never leave the server unless that player may see them. Mafia members see their allies. Eliminated players become spectators who see every role. Roles of the dead are revealed only if the host enables it, and everything is revealed when the game ends.

**Identity.** Each browser gets a guest id and a secret on first connect. Reconnecting with them puts the player back in their seat mid-game. An optional username and password account, hashed with scrypt, carries that identity to other devices.

**Offline.** Local mode runs the engine in the browser and saves to localStorage. A service worker caches the app shell in production builds, so the game reopens without a connection.

## Notes on the stack

The brief suggested Supabase. This project uses a small Node WebSocket server instead, because it can run the same TypeScript engine as the client. That gives true server-side rule enforcement and per-player redaction without duplicating the rules in SQL or edge functions. Persistence is a JSON file. Swapping `server/store.ts` for PostgreSQL is a contained change.
