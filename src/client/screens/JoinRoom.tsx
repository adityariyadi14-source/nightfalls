import { useEffect, useState } from 'react';
import { Button, Page, Panel, TopBar } from '../components/ui';
import { navigate } from '../lib/router';
import { connect, send, useOnline } from '../online/socket';
import { t } from '../lib/i18n';
import { THEMES } from '../lib/themes';

export function JoinRoom({ initialCode }: { initialCode?: string }) {
  const online = useOnline();
  const [code, setCode] = useState((initialCode ?? '').toUpperCase());
  useEffect(() => {
    connect();
    const t = setInterval(() => online.status === 'online' && send({ t: 'listRooms' }), 3000);
    if (online.status === 'online') send({ t: 'listRooms' });
    return () => clearInterval(t);
  }, [online.status]);
  useEffect(() => {
    if (online.room) navigate('/room');
  }, [online.room?.code]);
  const join = (c: string) => send({ t: 'joinRoom', code: c.trim().toUpperCase() });

  return (
    <Page>
      <TopBar title="Join room" onBack={() => navigate('/menu')} />
      <div className="space-y-4">
        <Panel title={t("Room code")}>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.length === 5) join(code); }}>
            <input className="input font-display text-center text-2xl font-bold uppercase tracking-[0.5em]" value={code} maxLength={5} autoFocus onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABCDE" />
            <Button type="submit" disabled={code.length !== 5 || online.status !== 'online'}>{t("Join")}</Button>
          </form>
        </Panel>
        <Panel title={t("Public lobbies")} right={<Button size="sm" variant="ghost" onClick={() => send({ t: 'quickJoin' })} disabled={online.status !== 'online'}>{t("Quick match")}</Button>}>
          {online.rooms.length === 0 ? (
            <p className="text-sm text-muted">{online.status === 'online' ? t('No public lobbies right now. Start one with Quick match.') : t('Connecting…')}</p>
          ) : (
            <div className="space-y-2">
              {online.rooms.map((r) => (
                <button key={r.code} onClick={() => join(r.code)} className="flex w-full items-center justify-between rounded-xl border border-line/50 bg-ink/40 px-4 py-3 text-left hover:border-accent/60">
                  <div>
                    <div className="font-semibold">{r.hostName}'s room <span className="text-muted">#{r.code}</span></div>
                    <div className="text-xs text-muted">{THEMES.find((t) => t.id === r.theme)?.name ?? r.theme}</div>
                  </div>
                  <span className="chip">{r.players}/{r.maxPlayers}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </Page>
  );
}
