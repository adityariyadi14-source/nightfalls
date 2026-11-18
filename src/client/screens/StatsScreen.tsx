import { useEffect, useMemo, useState } from 'react';
import { ROLES } from '../../engine';
import type { RoleId } from '../../engine';
import type { MatchRecord } from '../../shared/protocol';
import { Avatar } from '../components/Avatar';
import { RoleBadge } from '../components/RoleBadge';
import { Button, Page, Panel, Segmented, TopBar } from '../components/ui';
import { computeStats, loadLocalHistory } from '../lib/stats';
import { navigate } from '../lib/router';
import { usePrefs } from '../lib/prefs';
import { connect, send, useOnline } from '../online/socket';
import { ONLINE_AVAILABLE, safeStorage } from '../lib/env';
import { t } from '../lib/i18n';
import { Icon, RoleIcon } from '../components/Icon';

export function StatsScreen() {
  const prefs = usePrefs();
  const online = useOnline();
  const [tab, setTab] = useState<'online' | 'local'>(ONLINE_AVAILABLE ? 'online' : 'local');
  const [localHistory, setLocalHistory] = useState<MatchRecord[]>([]);
  useEffect(() => {
    connect();
    setLocalHistory(loadLocalHistory());
  }, []);
  useEffect(() => {
    if (online.status === 'online') send({ t: 'getHistory' });
  }, [online.status]);

  const matches = tab === 'online' ? online.history ?? [] : localHistory;
  const stats = useMemo(() => computeStats(matches, [prefs.guestId ?? ''], tab === 'local' ? [prefs.name] : []), [matches, prefs.guestId, prefs.name, tab]);
  const pct = (w: number, g: number) => (g ? `${Math.round((w / g) * 100)}%` : '—');

  return (
    <Page>
      <TopBar title={t("Statistics")} onBack={() => navigate('/menu')} />
      <div className="mb-4 flex items-center gap-3">
        <Avatar index={prefs.avatar} photo={prefs.photo} size={44} />
        <div><div className="font-semibold">{prefs.name}</div><div className="text-xs text-muted">{tab === 'online' ? t('Online matches linked to this guest account') : t(`Local matches where a player was named "${prefs.name}"`)}</div></div>
      </div>
      {ONLINE_AVAILABLE && <Segmented value={tab} onChange={setTab} options={[{ value: 'online', label: 'Online' }, { value: 'local', label: 'Local' }]} />}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t('Games'), stats.games],
          [t('Win rate'), pct(stats.wins, stats.games)],
          [t('Survival'), pct(stats.survived, stats.games)],
          [t('Best streak'), stats.bestStreak]
        ].map(([l, v]) => (
          <div key={String(l)} className="glass rounded-2xl p-4 text-center"><div className="font-display text-3xl font-black">{v}</div><div className="label mt-1">{l}</div></div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title={t("By team")}>
          {(['town', 'mafia', 'neutral'] as const).map((tm) => (
            <div key={tm} className="mb-2 flex items-center gap-3 text-sm">
              <span className="w-16 capitalize">{tm}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/70"><div className={`h-full ${tm === 'mafia' ? 'bg-danger' : tm === 'town' ? 'bg-sky-400' : 'bg-fuchsia-400'}`} style={{ width: stats.byTeam[tm].games ? `${(stats.byTeam[tm].wins / stats.byTeam[tm].games) * 100}%` : 0 }} /></div>
              <span className="w-20 text-right text-muted">{stats.byTeam[tm].wins}/{stats.byTeam[tm].games} · {pct(stats.byTeam[tm].wins, stats.byTeam[tm].games)}</span>
            </div>
          ))}
        </Panel>
        <Panel title={t("By role")}>
          {Object.keys(stats.byRole).length === 0 && <p className="text-sm text-muted">{t("Play a game to see role stats.")}</p>}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(stats.byRole) as [RoleId, { games: number; wins: number }][]).sort((a, b) => b[1].games - a[1].games).map(([r, s]) => (
              <div key={r} className="flex items-center gap-2 rounded-xl border border-line/50 bg-ink/40 px-2 py-1 text-xs"><RoleBadge role={r} /><span className="text-muted">{s.wins}/{s.games}</span></div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title={t(`Match history · ${matches.length}`)} className="mt-4">
        {matches.length === 0 && <p className="text-sm text-muted">{tab === 'online' && online.status !== 'online' ? t('Connect to the server to load your online history.') : t('No matches yet.')}</p>}
        <div className="space-y-2">
          {matches.slice(0, 50).map((m) => {
            const me = m.players.find((p) => p.id === prefs.guestId) ?? m.players.find((p) => p.name === prefs.name);
            const color = m.winner === 'mafia' ? 'text-danger' : m.winner === 'town' ? 'text-sky-300' : 'text-fuchsia-300';
            return (
              <details key={m.id} className="rounded-xl border border-line/50 bg-ink/40 px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm">
                  <span><span className={`font-semibold capitalize ${color}`}>{m.winner === 'draw' ? t('Draw') : t(m.winner === 'town' ? 'town win' : m.winner === 'mafia' ? 'mafia win' : 'neutral win')}</span> <span className="text-muted">· {m.players.length} players · {m.days} day{m.days === 1 ? '' : 's'} · {new Date(m.endedAt).toLocaleString()}</span></span>
                  {me && <span className={`chip ${me.won ? '!border-accent2/50 !text-accent2' : ''}`}><RoleIcon role={me.role} size={11} /> {me.won ? t('won') : t('lost')}</span>}
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.players.map((p) => <span key={p.id} className={`chip ${p.won ? '!border-accent2/40' : ''}`}><RoleIcon role={p.role} size={11} /> {p.name}{!p.alive ? ' · dead' : ''}</span>)}
                </div>
              </details>
            );
          })}
        </div>
      </Panel>
      {tab === 'local' && localHistory.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => { safeStorage.remove('nightfall.history.v1'); setLocalHistory([]); }}>{t("Clear local history")}</Button>
      )}
    </Page>
  );
}
