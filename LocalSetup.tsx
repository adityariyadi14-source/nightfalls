import { useState } from 'react';
import { defaultSettings, MAX_LOCAL_PLAYERS, MIN_PLAYERS, validateRoles } from '../../engine';
import type { GameSettings } from '../../engine';
import { Avatar } from '../components/Avatar';
import { SettingsForm } from '../components/SettingsForm';
import { Button, Page, Panel, TopBar } from '../components/ui';
import { navigate } from '../lib/router';
import { usePrefs } from '../lib/prefs';
import { startLocalGame } from '../local/localGame';
import { sfx } from '../lib/audio';
import { Background } from '../components/Background';
import { t } from '../lib/i18n';
import { fileToSource, renderPhoto } from '../lib/photo';
import { getPrefs } from '../lib/prefs';
import { toast } from '../lib/toast';
import { Icon } from '../components/Icon';

const KEY = 'nightfall.local.setup.v1';
const DEFAULT_NAMES = ['Ava', 'Ben', 'Cleo', 'Dev', 'Esme', 'Finn', 'Gia', 'Hugo', 'Iris', 'Jude', 'Kai', 'Lena', 'Milo', 'Nia', 'Otis', 'Pia', 'Quinn', 'Rae', 'Sol', 'Tess', 'Uma', 'Vik', 'Wes', 'Xia', 'Yara', 'Zed'];

interface Setup { players: { name: string; avatar: number; photo?: string }[]; settings: GameSettings }

function loadSetup(theme: string): Setup {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Setup;
      // settings saved by older versions miss newer options
      return { ...saved, settings: { ...defaultSettings(saved.players.length), ...saved.settings } };
    }
  } catch { /* ignore */ }
  return { players: Array.from({ length: 6 }, (_, i) => ({ name: DEFAULT_NAMES[i], avatar: i })), settings: { ...defaultSettings(6), theme, discussionSeconds: 180 } };
}

export function LocalSetup() {
  const prefs = usePrefs();
  const [setup, setSetupState] = useState<Setup>(() => loadSetup(prefs.theme));
  const setSetup = (s: Setup) => {
    setSetupState(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  };
  const players = setup.players;
  const err = validateRoles(setup.settings, players.length) ?? (players.some((p) => !p.name.trim()) ? t('Every player needs a name.') : null);
  const dupes = new Set(players.map((p) => p.name.trim().toLowerCase())).size !== players.length;

  const addPlayer = () => {
    if (players.length >= MAX_LOCAL_PLAYERS) return;
    const i = players.length;
    setSetup({ ...setup, players: [...players, { name: DEFAULT_NAMES[i % DEFAULT_NAMES.length] + (i >= 26 ? ` ${Math.floor(i / 26) + 1}` : ''), avatar: i % 24 }], settings: { ...setup.settings, roles: defaultSettings(i + 1).roles } });
  };
  const removePlayer = (i: number) => {
    const next = players.filter((_, j) => j !== i);
    setSetup({ ...setup, players: next, settings: { ...setup.settings, roles: defaultSettings(next.length).roles } });
  };

  return (
    <Page>
      <Background theme={setup.settings.theme} />
      <TopBar title="Local pass & play" onBack={() => navigate('/menu')} />
      <div className="space-y-4">
        <Panel title={t(`Players · ${players.length}`)} right={<span className="chip">{MIN_PLAYERS}–{MAX_LOCAL_PLAYERS}</span>}>
          <div className="grid gap-2 sm:grid-cols-2">
            {players.map((p, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-line/50 bg-ink/40 p-2">
                <button onClick={() => { sfx.select(); setSetup({ ...setup, players: players.map((q, j) => (j === i ? { ...q, avatar: (q.avatar + 1) % 24 } : q)) }); }} title={t("Change avatar")}><Avatar index={p.avatar} photo={p.photo} size={36} /></button>
                <input className="min-w-0 flex-1 bg-transparent px-1 text-sm font-medium outline-none" value={p.name} maxLength={16} onChange={(e) => setSetup({ ...setup, players: players.map((q, j) => (j === i ? { ...q, name: e.target.value } : q)) })} />
                <label className="cursor-pointer px-1.5 text-muted hover:text-accent" title={t('Add a photo')}>
                  <Icon name="photo" size={16} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      try {
                        const photo = await renderPhoto(await fileToSource(f), getPrefs().photoPixel);
                        setSetup({ ...setup, players: players.map((q, j) => (j === i ? { ...q, photo } : q)) });
                      } catch (err) {
                        toast(t((err as Error).message), 'error');
                      }
                    }}
                  />
                </label>
                {p.photo && <button className="px-1 text-[10px] font-bold uppercase text-muted hover:text-danger" onClick={() => setSetup({ ...setup, players: players.map((q, j) => (j === i ? { ...q, photo: undefined } : q)) })}>{t('No photo')}</button>}
                <button className="px-2 text-muted hover:text-danger" disabled={players.length <= MIN_PLAYERS} onClick={() => removePlayer(i)} aria-label="Remove"><Icon name="x" size={14} /></button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" disabled={players.length >= MAX_LOCAL_PLAYERS} onClick={addPlayer}>{t("+ Add player")}</Button>
            {dupes && <span className="chip !border-amber-400/50 !text-amber-300">{t("Names should be unique")}</span>}
          </div>
        </Panel>
        <SettingsForm settings={setup.settings} playerCount={players.length} mode="local" onChange={(p) => setSetup({ ...setup, settings: { ...setup.settings, ...p } })} />
        <div className="sticky bottom-3">
          <Button size="lg" className="w-full shadow-glow" disabled={!!err} onClick={() => { startLocalGame(players.map((p) => ({ name: p.name.trim(), avatar: p.avatar, photo: p.photo })), setup.settings); navigate('/local/play'); }}>
            {err ?? t('Deal roles & start')}
          </Button>
        </div>
      </div>
    </Page>
  );
}
