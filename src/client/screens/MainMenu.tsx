import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar, AVATARS } from '../components/Avatar';
import { Button, Modal, Page } from '../components/ui';
import { Icon } from '../components/Icon';
import { usePrefs, setPrefs, getPrefs } from '../lib/prefs';
import { navigate } from '../lib/router';
import { connect, useOnline, send } from '../online/socket';
import { hasLocalGame, useLocalGame } from '../local/localGame';
import { sfx } from '../lib/audio';
import { t } from '../lib/i18n';
import { LangSwitch } from '../components/LangSwitch';
import { ResidentCard } from '../components/ResidentCard';
import { ONLINE_AVAILABLE } from '../lib/env';

interface Command {
  icon: string;
  title: string;
  desc: string;
  run: () => void;
  disabled?: boolean;
  hot?: boolean;
}

function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function MainMenu() {
  const prefs = usePrefs();
  const online = useOnline();
  const local = useLocalGame();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(prefs.name);
  const [focus, setFocus] = useState(0);
  const clock = useClock();
  useEffect(() => connect(), []);
  const resumable = !!local && hasLocalGame();

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    if (resumable) list.push({ icon: 'device', title: 'Resume local game', desc: `Day ${local!.state.day} · ${local!.state.players.length} players · saved on this device`, run: () => navigate('/local/play'), hot: true });
    if (ONLINE_AVAILABLE) {
      list.push(
        { icon: 'house', title: 'Create room', desc: 'Host a private or public room. 4–15 players.', run: () => navigate('/create'), hot: !resumable },
        { icon: 'key', title: 'Join room', desc: 'Enter a five-character room code.', run: () => navigate('/join') },
        { icon: 'bolt', title: 'Quick match', desc: 'Drop into a public lobby.', run: () => { send({ t: 'quickJoin' }); navigate('/room'); }, disabled: online.status !== 'online' }
      );
    }
    list.push(
      { icon: resumable ? 'new' : 'device', title: resumable ? 'New local game' : 'Local pass & play', desc: 'One device, 4–36 players, no connection needed.', run: () => navigate('/local'), hot: !ONLINE_AVAILABLE && !resumable },
      { icon: 'chart', title: 'Statistics', desc: 'Win rates, roles played, match history.', run: () => navigate('/stats') },
      { icon: 'book', title: 'How to play', desc: 'Roles, phases, win conditions.', run: () => navigate('/rules') },
      { icon: 'gear', title: 'Settings', desc: 'Profile, colour profile, sound.', run: () => navigate('/settings') }
    );
    return list;
  }, [resumable, online.status, local?.state.day]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (edit || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const n = Number(e.key);
      if (n >= 1 && n <= commands.length) {
        const c = commands[n - 1];
        if (!c.disabled) { sfx.click(); c.run(); }
      } else if (e.key === 'ArrowDown') { e.preventDefault(); setFocus((f) => (f + 1) % commands.length); sfx.hover(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setFocus((f) => (f - 1 + commands.length) % commands.length); sfx.hover(); }
      else if (e.key === 'Enter' && !commands[focus]?.disabled) { sfx.click(); commands[focus]?.run(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [commands, focus, edit]);

  const statusText = !ONLINE_AVAILABLE ? t('LOCAL TERMINAL') : online.status === 'online' ? t('CHANNEL SECURE') : online.status === 'connecting' ? t('CONNECTING') : t('OFFLINE · LOCAL ONLY');
  const statusColor = !ONLINE_AVAILABLE || online.status === 'online' ? 'text-accent2' : online.status === 'connecting' ? 'text-amber-300' : 'text-muted';

  return (
    <Page wide>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
        <span><span className="text-accent">■</span> {t("Nightfall terminal")}</span>
        <span className="flex items-center gap-3"><LangSwitch /><span className="tabular-nums">{clock} · <span className={statusColor}>{statusText}</span></span></span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-x-12 lg:gap-y-8">
        <div className="lg:col-start-1 lg:row-start-1">
          <h1 className="title glitch text-glow text-[clamp(3.6rem,12vw,7.5rem)] leading-[0.85]">{t("Nightfall")}</h1>
          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted">{t("Select a command. Use the number keys or arrows and Enter.")}</p>
        </div>
        <div className="flex flex-col lg:col-start-1 lg:row-start-2">

          <button onClick={() => { sfx.click(); setName(prefs.name); setEdit(true); }} className="glass group flex items-center gap-4 p-4 text-left transition hover:border-accent/70">
            <Avatar index={prefs.avatar} photo={prefs.photo} size={64} />
            <div className="min-w-0 flex-1">
              <div className="label">{t("Resident card")}</div>
              <div className="title mt-1 truncate text-3xl">{prefs.name}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-muted">{online.username ? t(`Account · ${online.username}`) : t('Guest profile')}</div>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted group-hover:text-accent">{t("Edit")}</span>
          </button>

          {online.room && (
            <button onClick={() => navigate('/room')} className="mt-3 flex items-center justify-between gap-3 border border-accent bg-accent/10 p-4 text-left">
              <div>
                <div className="text-[13px] font-bold uppercase tracking-wider">Room #{online.room.code}</div>
                <div className="text-[11px] text-muted">{online.room.status === 'playing' ? t('Game in progress') : t(`${online.room.players.length} players in the lobby`)}</div>
              </div>
              <span className="btn-primary !px-3 !py-1.5 !text-[11px]">{t("Return")}</span>
            </button>
          )}

          {!ONLINE_AVAILABLE && (
            <div className="mt-3 border border-line/70 bg-ink/50 p-4 text-[12px] leading-relaxed text-muted">
              <span className="font-bold text-fg">{t("Notice.")}</span> {t("This edition runs on one device: pass it around the table. Online rooms across devices need the Nightfall game server. Run it from the project with")} <span className="text-fg">{t("npm run dev")}</span>.
            </div>
          )}
        </div>

        <nav aria-label="Main menu" className="flex flex-col self-start border-t border-line/60 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {commands.map((c, i) => {
            const active = focus === i;
            return (
              <motion.button
                key={t(c.title)}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.2 }}
                disabled={c.disabled}
                onMouseEnter={() => setFocus(i)}
                onFocus={() => setFocus(i)}
                onClick={() => { sfx.click(); c.run(); }}
                className={`group relative grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-line/60 px-2 py-4 text-left transition-colors disabled:opacity-35 sm:py-5 ${active ? 'bg-accent text-ink' : c.hot ? 'text-fg' : 'text-fg/85'}`}
              >
                <span className={`font-mono text-[12px] font-bold ${active ? 'text-ink' : 'text-accent'}`}>{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <span className="title flex items-center gap-2 text-[1.75rem] sm:text-[2.1rem]">
                    {t(c.title)}
                    {c.hot && !active && <span className="font-body text-[10px] tracking-[0.2em] text-accent">{'● '}{t('ready')}</span>}
                  </span>
                  <span className={`mt-1 block truncate text-[12px] ${active ? 'text-ink/75' : 'text-muted'}`}>{t(c.desc)}</span>
                </span>
                <Icon name={c.icon} size={22} className={active ? 'text-ink' : 'text-muted group-hover:text-accent'} />
              </motion.button>
            );
          })}
        </nav>
      </div>

      <Modal open={edit} onClose={() => setEdit(false)} title={t("Resident card")}>
        <div className="scrollbar-thin max-h-[78vh] overflow-y-auto pr-1">
          <ResidentCard />
          <Button className="mt-3 w-full" onClick={() => setEdit(false)}>Done</Button>
        </div>
      </Modal>
    </Page>
  );
}
