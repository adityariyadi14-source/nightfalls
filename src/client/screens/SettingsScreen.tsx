import { useState } from 'react';
import { Avatar, AVATARS } from '../components/Avatar';
import { Button, Field, Page, Panel, Toggle, TopBar } from '../components/ui';
import { usePrefs, setPrefs, getPrefs } from '../lib/prefs';
import { THEMES } from '../lib/themes';
import { ThemeSwatch } from '../components/SettingsForm';
import { navigate } from '../lib/router';
import { setVolume, syncMusic, sfx } from '../lib/audio';
import { connect, send, useOnline } from '../online/socket';
import { useEffect } from 'react';
import { toast } from '../lib/toast';
import { t } from '../lib/i18n';
import { LangSwitch } from '../components/LangSwitch';
import { ResidentCard } from '../components/ResidentCard';
import { ONLINE_AVAILABLE, safeStorage } from '../lib/env';

export function SettingsScreen() {
  const prefs = usePrefs();
  const online = useOnline();
  const [name, setName] = useState(prefs.name);
  return (
    <Page>
      <TopBar title="Settings" onBack={() => navigate('/menu')} />
      <div className="space-y-4">
        <Panel title="Language" right={<LangSwitch />}>
          <p className="text-[12px] text-muted">{t('English and Bahasa Indonesia. The game log and crime scenes follow your choice.')}</p>
        </Panel>
        <Panel title="Resident card">
          <ResidentCard />
        </Panel>
        <Panel title={t("Sound")}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle checked={prefs.sfx} onChange={(v) => setPrefs({ sfx: v })} label="Sound effects" />
            <Toggle checked={prefs.music} onChange={(v) => { setPrefs({ music: v }); syncMusic(); }} label="Ambient music" hint="Procedurally generated" />
          </div>
          <Field label="Volume" hint={`${Math.round(prefs.volume * 100)}%`}>
            <input type="range" min={0} max={100} value={Math.round(prefs.volume * 100)} onChange={(e) => { const v = Number(e.target.value) / 100; setPrefs({ volume: v }); setVolume(v); }} onMouseUp={() => sfx.notify()} className="mt-2 w-full accent-[rgb(var(--c-accent))]" />
          </Field>
        </Panel>
        <Panel title="Colour profile">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {THEMES.map((th) => (
              <button key={th.id} onClick={() => { sfx.select(); setPrefs({ theme: th.id }); }} className={`rounded-xl border p-3 text-left transition ${prefs.theme === th.id ? 'border-accent bg-accent/15 shadow-glow' : 'border-line/50 bg-ink/40 hover:border-accent/50'}`}>
                <ThemeSwatch vars={th.vars} />
                <div className="mt-2 text-[12px] font-bold uppercase tracking-wider">{th.name}</div>
                <div className="text-[11px] text-muted">{th.description}</div>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title={t("Data")}>
          <Button variant="danger" size="sm" onClick={() => { safeStorage.clear(); toast('Local data cleared. Reloading…', 'warn'); setTimeout(() => location.reload(), 800); }}>{t("Reset everything on this device")}</Button>
        </Panel>
      </div>
    </Page>
  );
}

function AccountPanel() {
  const online = useOnline();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  useEffect(() => connect(), []);
  const offline = online.status !== 'online';
  if (online.username) {
    return (
      <Panel title={t("Account")}>
        <p className="text-sm">{t("Signed in as")} <strong className="text-accent">{online.username}</strong>{t(". Your identity, reconnects and match history follow you to any device you log in from.")}</p>
        <Button className="mt-3" size="sm" variant="ghost" onClick={() => send({ t: 'logout' })}>{t("Log out")}</Button>
      </Panel>
    );
  }
  return (
    <Panel title={t("Account (optional)")}>
      <p className="mb-3 text-sm text-muted">You are playing as a guest. {mode === 'register' ? t('Create an account to keep this profile and its history on other devices.') : t('Log in to use your account on this device.')}</p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          send({ t: mode, username: username.trim(), password });
          setPassword('');
        }}
      >
        <input className="input" placeholder={t("Username")} autoComplete="username" value={username} maxLength={20} onChange={(e) => setUsername(e.target.value)} />
        <input className="input" type="password" placeholder={t("Password")} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={offline || username.trim().length < 3 || password.length < 6}>{mode === 'register' ? 'Create account' : 'Log in'}</Button>
          <button type="button" className="text-sm text-accent2 hover:underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? t('No account? Create one') : t('Have an account? Log in')}</button>
          {offline && <span className="text-xs text-muted">{t("Connect to the server to use accounts.")}</span>}
        </div>
      </form>
    </Panel>
  );
}
