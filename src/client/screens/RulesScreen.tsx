import { ROLES, ROLE_ORDER, TEAM_LABEL, EVENTS } from '../../engine';
import { Page, Panel, TopBar } from '../components/ui';
import { navigate } from '../lib/router';
import { t } from '../lib/i18n';
import { Icon, RoleIcon } from '../components/Icon';

export function RulesScreen() {
  return (
    <Page>
      <TopBar title="How to play" onBack={() => history.length > 1 ? history.back() : navigate('/menu')} />
      <div className="space-y-4">
        <Panel title={t("The loop")}>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-fg/90">
            <li><strong>{t("Roles are dealt in secret.")}</strong> {t("Most players are Town. A few are Mafia. Some are Neutral with their own goals.")}</li>
            <li><strong>{t("Night.")}</strong> {t("The Mafia secretly picks a victim. The Detective investigates, the Doctor protects, and other roles act in private.")}</li>
            <li><strong>{t("Day.")}</strong> {t("The town learns who died, discusses, accuses, and then votes. The player with the most votes is eliminated.")}</li>
            <li><strong>{t("Repeat")}</strong> {t("until the Town eliminates every Mafia, or the Mafia equals the rest of the town.")}</li>
          </ol>
        </Panel>
        {(['town', 'mafia', 'neutral'] as const).map((team) => (
          <Panel key={team} title={t('{team} roles', { team: TEAM_LABEL[team] })}>
            <div className="space-y-2">
              {ROLE_ORDER.filter((r) => ROLES[r].team === team).map((r) => (
                <div key={r} className="flex gap-3 rounded-xl border border-line/40 bg-ink/30 p-3">
                  <span style={{ color: ROLES[r].color }}><RoleIcon role={r} size={26} /></span>
                  <div><div className="font-semibold" style={{ color: ROLES[r].color }}>{t(ROLES[r].name)}</div><div className="text-sm text-muted">{t(ROLES[r].description)}</div></div>
                </div>
              ))}
            </div>
          </Panel>
        ))}
        <Panel title={t("Random events")}>
          <div className="space-y-2">
            {Object.values(EVENTS).map((e) => (
              <div key={e.id} className="flex gap-3 text-sm"><span className="text-accent2"><Icon name={e.id} size={20} /></span><div><strong>{t(e.name)}</strong> <span className="text-muted">({e.phase})</span><div className="text-muted">{t(e.description)}</div></div></div>
            ))}
          </div>
        </Panel>
        <Panel title="Hard mode">
          <p className="text-sm text-fg/90">{t('For 10 or more players. Every player gets one public trait, shown under their name. Each night the Detective receives three clue words instead of a verdict. Each word hints at one player’s trait, and exactly one of those three players is Mafia.')}</p>
        </Panel>
        <Panel title={t("Win conditions")}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-fg/90">
            <li><strong>{t("Town")}</strong> {t("wins when all Mafia are gone.")}</li>
            <li><strong>{t("Mafia")}</strong> {t("wins when they equal or outnumber everyone else.")}</li>
            <li><strong>{t("Jester")}</strong> {t("wins if voted out by the town (the game continues).")}</li>
            <li><strong>{t("Survivor")}</strong> {t("wins if alive at the end, alongside the winning team.")}</li>
          </ul>
        </Panel>
      </div>
    </Page>
  );
}
