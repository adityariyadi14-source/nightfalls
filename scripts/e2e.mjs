// Browser end-to-end: 5 real browser contexts play an online game via the UI, then one plays a local game.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = req(process.env.PLAYWRIGHT_PATH ?? '/opt/node-tools/node_modules/playwright'); }
const { chromium } = pw;

const PORT = 8791;
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS ?? '/tmp/nf-shots';
fs.mkdirSync(SHOTS, { recursive: true });
const srv = spawn('node_modules/.bin/tsx', ['server/index.ts'], { env: { ...process.env, PORT: String(PORT), DATA_FILE: '/tmp/nf-e2e.json' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => srv.stdout.on('data', (d) => String(d).includes('listening') && r()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const assert = (c, m) => { if (!c) { console.error('ASSERT FAIL:', m); failed = true; throw new Error(m); } else console.log('ok -', m); };

const browser = await chromium.launch();
const names = ['Ava', 'Ben', 'Cy', 'Dee', 'Eli'];
const ctxs = [];
const pages = [];
const mkCtx = async (name, storage) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, storageState: storage });
  if (!storage) await ctx.addInitScript((n) => { if (!localStorage.getItem('nightfall.prefs.v1')) localStorage.setItem('nightfall.prefs.v1', JSON.stringify({ name: n, avatar: 3, theme: 'midnight', sfx: false, music: false, volume: 0.5, guestId: null, secret: null, localId: 'x' })); }, name);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${name}] pageerror`, e.message));
  return [ctx, page];
};
const phaseOf = async (page) => (await page.locator('header [data-phase]').textContent()).trim();
const allPhase = async () => Promise.all(pages.map(phaseOf));
const waitPhase = async (re, timeout = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ph = await allPhase();
    if (ph.every((p) => re.test(p))) return ph;
    await sleep(250);
  }
  throw new Error(`phase timeout: ${JSON.stringify(await allPhase())} expected ${re}`);
};
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });

try {
  for (const n of names) { const [c, p] = await mkCtx(n); ctxs.push(c); pages.push(p); }
  const [host, ...others] = pages;
  await host.goto(`${BASE}/#/`);
  await shot(host, '01-landing');
  await host.click('text=Play now');
  await host.waitForSelector('text=Create room');
  await shot(host, '02-menu');
  await host.click('text=Create room');
  await host.waitForSelector('button:has-text("Create room")');
  await shot(host, '03-create');
  await host.click('button:has-text("Create room")');
  await host.waitForSelector('text=Lobby');
  const code = (await host.locator('h1 .font-mono').textContent()).trim();
  assert(/^[A-Z0-9]{5}$/.test(code), `room code ${code}`);
  for (const p of others) {
    await p.goto(`${BASE}/#/join/${code}`);
    await p.waitForSelector('button:has-text("Join")');
    await p.click('button:has-text("Join")');
    await p.waitForSelector('text=Lobby');
  }
  await sleep(500);
  await shot(host, '04-lobby');
  for (const p of pages) assert((await p.locator('.card-player').count()) >= 5, 'lobby shows 5 players');
  // Lobby chat
  await others[0].fill('input[placeholder="Message…"]', 'hello everyone');
  await others[0].press('input[placeholder="Message…"]', 'Enter');
  await sleep(300);
  assert(await host.locator('text=hello everyone').count() === 1, 'lobby chat synced to host');
  // Host changes a setting via modal
  await host.click('button:has-text("Game settings")');
  await host.waitForSelector('text=Tie-break');
  await host.click('button:has-text("Revote")');
  await host.click('button:has-text("Done")');
  await sleep(300);
  assert((await others[1].locator('text=tie: revote').count()) === 1, 'settings synced to other players');

  await host.click('button:has-text("Start game")');
  await waitPhase(/Role reveal/);
  await sleep(600);
  await pages[1].click('.cursor-pointer');
  await sleep(1000);
  await shot(pages[1], '05-role-reveal');
  const roles = {};
  for (const p of pages) {
    if (await p.locator('.cursor-pointer').count()) await p.locator('.cursor-pointer').first().click({ force: true });
    await p.waitForSelector('button:has-text("I\'m ready")', { timeout: 5000 });
    roles[names[pages.indexOf(p)]] = (await p.locator('header span[style]').textContent()).trim();
    await p.click('button:has-text("I\'m ready")');
  }
  console.log('roles:', roles);
  await waitPhase(/Night 1/);
  await sleep(2500); // transition
  await shot(pages[Object.values(roles).indexOf('Mafia')], '06-night-mafia');

  // Reconnect: Ben closes and reopens
  const benState = await ctxs[1].storageState();
  await pages[1].close();
  await ctxs[1].close();
  await sleep(800);
  assert((await host.locator('[title="Disconnected"]').count()) >= 1, 'host sees Ben disconnected');
  const [c2, p2] = await mkCtx('Ben', benState);
  ctxs[1] = c2; pages[1] = p2;
  await p2.goto(`${BASE}/#/room`);
  await p2.waitForSelector('header .chip', { timeout: 10000 });
  await sleep(1500);
  assert(/Night 1/.test(await phaseOf(p2)), 'Ben reconnected into night 1');
  assert((await host.locator('[title="Disconnected"]').count()) === 0, 'host sees Ben connected again');
  const benRoleAfter = (await p2.locator('header span[style]').textContent()).trim();
  assert(benRoleAfter === roles.Ben, `Ben keeps role after reconnect (${roles.Ben} -> ${benRoleAfter})`);

  // Night actions: everyone with a prompt picks the first target
  for (const p of pages) {
    const cards = p.locator('section .card-player.selectable');
    if (await cards.count()) await cards.first().click();
  }
  await waitPhase(/Dawn 1/, 15000);
  await sleep(1500);
  await shot(host, '07-dawn');
  await host.click('button:has-text("Skip to discussion")');
  await waitPhase(/Discussion 1/);
  await sleep(2000);
  // chat
  const alive = [];
  for (const p of pages) { if (!(await p.locator('header').first().textContent()).includes('dead')) alive.push(p); }
  const speaker = alive.find((p) => p !== host) ?? host;
  await speaker.fill('input[placeholder="Message…"]', 'I think it is Cy');
  await speaker.press('input[placeholder="Message…"]', 'Enter');
  await sleep(400);
  assert((await host.locator('text=I think it is Cy').count()) === 1, 'public chat synced');
  await shot(host, '08-discussion');
  await host.click('button:has-text("End discussion")');
  await waitPhase(/Voting 1/);
  await sleep(2500);
  // Everyone alive votes for the first enabled candidate
  for (const p of alive) {
    const btn = p.locator('section button:not([disabled]):has(.font-display)').first();
    if (await btn.count()) await btn.click();
  }
  await sleep(600);
  await shot(host, '09-voting');
  await waitPhase(/Defense 1|Verdict 1|Game over/, 15000);
  const ph = await allPhase();
  console.log('after vote:', ph[0]);
  if (/Defense/.test(ph[0])) {
    await sleep(2400);
    await shot(host, '10a-defense');
    await host.click('button:has-text("End defense")');
    await waitPhase(/Judgment 1/);
    await sleep(2400);
    for (const p of pages) { const g = p.locator('button:has-text("Guilty")').first(); if (await g.count()) await g.click().catch(() => {}); }
    await sleep(300);
    await shot(host, '10b-judgment');
    await waitPhase(/Verdict 1|Game over/, 30000);
    await sleep(4200);
    await shot(host, '10-verdict');
    assert((await host.locator('text=Trial verdict').count()) === 1 || /Game over/.test(await phaseOf(host)), 'verdict shows trial tally');
  }
  assert(new Set(await allPhase()).size === 1, 'all 5 clients agree on phase');
  // Keep playing automatically until game over (max 6 rounds)
  for (let round = 0; round < 30; round++) {
    const cur = await phaseOf(host);
    if (/Game over/.test(cur)) break;
    if (/Night/.test(cur)) {
      await sleep(2500);
      for (const p of pages) { const cards = p.locator('section .card-player.selectable'); if (await cards.count()) await cards.first().click(); }
      await waitPhase(/Dawn|Game over/, 60000);
    } else if (/Dawn/.test(cur)) {
      await sleep(800); await host.click('button:has-text("Skip to discussion")'); await waitPhase(/Discussion|Game over/);
    } else if (/Discussion/.test(cur)) {
      await sleep(800); await host.click('button:has-text("End discussion")'); await waitPhase(/Voting|Game over/);
    } else if (/Voting/.test(cur)) {
      await sleep(2500);
      for (const p of pages) { const btn = p.locator('section button:not([disabled]):has(.font-display)').first(); if (await btn.count()) await btn.click().catch(() => {}); }
      await waitPhase(/Defense|Verdict|Game over|Voting/, 60000);
      await sleep(2000);
    } else if (/Defense/.test(cur)) {
      await sleep(800); await host.click('button:has-text("End defense")').catch(() => {}); await waitPhase(/Judgment|Game over/);
    } else if (/Judgment/.test(cur)) {
      await sleep(2400);
      for (const p of pages) { const g = p.locator('button:has-text("Guilty")').first(); if (await g.count()) await g.click().catch(() => {}); }
      await waitPhase(/Verdict|Game over/, 60000);
    } else if (/Verdict/.test(cur)) {
      await sleep(800); await host.click('button:has-text("Continue")').catch(() => {}); await waitPhase(/Night|Game over/);
    }
  }
  const fin = await allPhase();
  console.log('final phases:', fin);
  assert(/Game over/.test(fin[0]), 'online game reached game over');
  if (/Game over/.test(fin[0])) {
    await sleep(1500);
    await shot(host, '11-results');
    assert((await host.locator('text=Play again').count()) === 1, 'host sees Play again');
    await host.click('text=Play again');
    await sleep(600);
    assert((await host.locator('text=Lobby').count()) >= 1, 'back to lobby after play again');
  }

  // ---------------- Local pass-and-play
  const [lc, lp] = await mkCtx('Local');
  await lp.setViewportSize({ width: 414, height: 860 });
  await lp.goto(`${BASE}/#/local`);
  await lp.waitForSelector('text=Deal roles');
  await shot(lp, '20-local-setup');
  await lp.click('button:has-text("Deal roles")');
  await lp.waitForSelector('text=Pass the device');
  await shot(lp, '21-pass');
  let seenJudge = false; let seenTask = false;
  const solveTask = async (pg) => {
    if (await pg.locator('text=Lock every door').count()) { for (let k = 0; k < 12 && (await pg.locator('button:has-text("open")').count()); k++) await pg.locator('button:has-text("open")').first().click({ force: true }); }
    else if (await pg.locator('text=Enter the safe code').count()) { const code = (await pg.locator('.tracking-\\[0\\.4em\\] span').first().textContent()).trim(); for (const d of code) await pg.locator(`button.h-11:text-is("${d}")`).click({ force: true }); }
    else if (await pg.locator('text=Wipe the window').count()) { for (let k = 0; k < 12 && (await pg.locator('button[aria-label="foggy"]').count()); k++) await pg.locator('button[aria-label="foggy"]').first().click({ force: true }); }
    else if (await pg.locator('text=Sort the case files').count()) { for (let n = 1; n <= 6; n++) await pg.locator(`button:text-is("${String(n).padStart(2, '0')}")`).click({ force: true }); }
    await sleep(150);
  };
  let steps = 0; let over = false; let seenNight = false; let seenBallot = false; let seenNightShot = false; let seenBallotShot = false;
  while (steps++ < 400) {
    if (await lp.locator('text=Play again').count()) { over = true; break; }
    const clickFirst = async (sel) => { const l = lp.locator(sel).first(); if (await l.count() && await l.isEnabled()) { await l.click({ force: true, timeout: 3000 }).catch(() => {}); return true; } return false; };
    if (await clickFirst('button:has-text("show me")')) { await sleep(150); continue; }
    if (await lp.locator('button:has-text("Got it")').count()) {
      if (!(await lp.locator('button:has-text("Got it")').isEnabled())) { if (await lp.locator('.cursor-pointer').count()) await lp.locator('.cursor-pointer').first().click({ force: true }); await sleep(900); }
      await clickFirst('button:has-text("Got it")'); continue;
    }
    if (await lp.locator('button:has-text("pass the device"), button:has-text("Choose or skip"), button:has-text("Finish your task")').count()) {
      if (await lp.locator('text=cast your verdict').count()) {
        seenJudge = true;
        await lp.locator('button:has-text("Guilty")').first().click({ force: true });
      } else if (await lp.locator('text=cast your vote').count()) {
        if (!seenBallotShot) { seenBallotShot = true; await shot(lp, '24-local-ballot'); }
        seenBallot = true;
        const btn = lp.locator('section button:not([disabled]):has(.font-display)').first();
        if (await btn.count()) await btn.click(); else await clickFirst('button:has-text("Skip vote")');
      } else {
        seenNight = true;
        if (!seenNightShot) { seenNightShot = true; await shot(lp, '22-local-night'); }
        const cards = lp.locator('section .card-player.selectable');
        if (await cards.count()) await cards.first().click();
        await clickFirst('button:has-text("Stay exposed")');
        if (await lp.locator('text=Finish your task').count()) { await solveTask(lp); seenTask = true; }
      }
      await sleep(100);
      await clickFirst('button:has-text("pass the device")'); await sleep(150); continue;
    }
    if (await clickFirst('button:has-text("Begin discussion")')) { await sleep(600); continue; }
    if (await clickFirst('button:has-text("Open the vote")')) { await sleep(600); continue; }
    if (await clickFirst('button:has-text("Continue")')) { await sleep(600); continue; }
    await sleep(200);
  }
  assert(seenNight && seenBallot, 'local game went through night prompts and secret ballots');
  assert(seenTask, 'idle players completed a night task');
  assert(seenJudge, 'local trial verdicts were cast in secret');
  assert(over, `local game reached game over in ${steps} steps`);
  await sleep(1200);
  await shot(lp, '23-local-results');
  await lc.close();
  console.log(failed ? 'E2E FAILED' : 'E2E OK');
} catch (e) {
  console.error(e);
  failed = true;
  try { for (const [i, p] of (await browser.contexts()).flatMap((c) => c.pages()).entries()) await p.screenshot({ path: `${SHOTS}/zz-failure-${i}.png` }); } catch {}
} finally {
  await browser.close();
  srv.kill();
  process.exit(failed ? 1 : 0);
}
