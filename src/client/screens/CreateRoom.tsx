import { useEffect, useState } from 'react';
import { defaultSettings } from '../../engine';
import type { GameSettings } from '../../engine';
import { SettingsForm } from '../components/SettingsForm';
import { Button, Page, Panel, Segmented, TopBar } from '../components/ui';
import { navigate } from '../lib/router';
import { connect, send, useOnline } from '../online/socket';
import { t } from '../lib/i18n';
import { usePrefs } from '../lib/prefs';

export function CreateRoom() {
  const online = useOnline();
  const prefs = usePrefs();
  const [isPublic, setPublic] = useState<'private' | 'public'>('private');
  const [expected, setExpected] = useState(6);
  const [settings, setSettings] = useState<GameSettings>(() => ({ ...defaultSettings(6), theme: prefs.theme }));
  useEffect(() => connect(), []);
  useEffect(() => {
    if (online.room) navigate('/room');
  }, [online.room?.code]);

  return (
    <Page>
      <TopBar title="Create room" onBack={() => navigate('/menu')} />
      <div className="space-y-4">
        <Panel title={t("Visibility")}>
          <Segmented value={isPublic} onChange={setPublic} options={[{ value: 'private', label: t('Private · code only') }, { value: 'public', label: t('Public matchmaking') }]} />
          <p className="mt-2 text-xs text-muted">{t("You can fine-tune everything again in the lobby once players arrive. Roles auto-balance to the player count.")}</p>
        </Panel>
        <Panel title={t("Expected players")}>
          <input type="range" min={4} max={15} value={expected} onChange={(e) => { const n = Number(e.target.value); setExpected(n); setSettings((s) => ({ ...s, roles: defaultSettings(n).roles })); }} className="w-full accent-[rgb(var(--c-accent))]" />
          <div className="text-sm text-muted">{t('{n} players (preview of role balance)', { n: expected })}</div>
        </Panel>
        <SettingsForm settings={settings} playerCount={expected} mode="online" onChange={(p) => setSettings((s) => ({ ...s, ...p }))} />
        <Button size="lg" className="w-full" disabled={online.status !== 'online'} onClick={() => send({ t: 'createRoom', isPublic: isPublic === 'public', settings })}>
          {online.status === 'online' ? 'Create room' : t('Connecting to server…')}
        </Button>
      </div>
    </Page>
  );
}
