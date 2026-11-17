import { useMemo } from 'react';
import { ROLES, ROLE_ORDER, validateRoles, suggestRoles, MAPS, MAP_IDS, HARD_MODE_MIN_PLAYERS } from '../../engine';
import type { GameSettings, RoleId } from '../../engine';
import { THEMES } from '../lib/themes';
import { Field, Panel, Segmented, Stepper, Toggle, Button } from './ui';
import { EVENTS } from '../../engine';
import { t } from '../lib/i18n';
import { Icon, RoleIcon } from './Icon';

export function SettingsForm({
  settings,
  onChange,
  playerCount,
  mode,
  readOnly
}: {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
  playerCount: number;
  mode: 'online' | 'local';
  readOnly?: boolean;
}) {
  const totalSpecial = Object.values(settings.roles).reduce((a, b) => a + (b ?? 0), 0);
  const citizens = Math.max(0, playerCount - totalSpecial);
  const error = useMemo(() => validateRoles(settings, playerCount), [settings, playerCount]);
  const setRole = (r: RoleId, n: number) => onChange({ roles: { ...settings.roles, [r]: n } });
  const fmtSec = (v: number) => (v >= 60 ? `${Math.floor(v / 60)}m${v % 60 ? ` ${v % 60}s` : ''}` : `${v}s`);
  const dis = readOnly ? 'pointer-events-none opacity-70' : '';

  return (
    <div className={`space-y-4 ${dis}`}>
      <Panel
        title="Roles"
        right={
          !readOnly && (
            <Button size="sm" variant="ghost" onClick={() => onChange({ roles: suggestRoles(playerCount) })}>
              {t("Auto-balance")}
            </Button>
          )
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="chip">{t('{n} players', { n: playerCount })}</span>
          <span className="chip">{t('{n} citizens fill the rest', { n: citizens })}</span>
          {error ? <span className="chip !border-danger/60 !text-danger">{t(error)}</span> : <span className="chip !border-accent2/50 !text-accent2">{t("Balanced")}</span>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLE_ORDER.filter((r) => r !== 'citizen').map((r) => {
            const def = ROLES[r];
            const n = settings.roles[r] ?? 0;
            return (
              <div key={r} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${n > 0 ? 'border-line/70 bg-ink/50' : 'border-line/30 bg-ink/20 opacity-80'}`}>
                <div className="flex min-w-0 items-center gap-2">
                  <span style={{ color: def.color }}><RoleIcon role={r} size={22} /></span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: def.color }}>{t(def.name)}</div>
                    <div className="truncate text-[11px] text-muted">{t(def.short)}</div>
                  </div>
                </div>
                <Stepper value={n} min={0} max={r === 'godfather' ? 1 : 6} onChange={(v) => setRole(r, v)} />
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Timers">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Discussion"><Stepper value={settings.discussionSeconds} min={20} max={600} step={10} format={fmtSec} onChange={(v) => onChange({ discussionSeconds: v })} /></Field>
          <Field label="Voting"><Stepper value={settings.votingSeconds} min={15} max={300} step={5} format={fmtSec} onChange={(v) => onChange({ votingSeconds: v })} /></Field>
          {mode === 'online' && (
            <>
              <Field label="Night"><Stepper value={settings.nightSeconds} min={15} max={180} step={5} format={fmtSec} onChange={(v) => onChange({ nightSeconds: v })} /></Field>
              <Field label="Role reveal"><Stepper value={settings.revealSeconds} min={5} max={60} step={5} format={fmtSec} onChange={(v) => onChange({ revealSeconds: v })} /></Field>
            </>
          )}
        </div>
      </Panel>

      <Panel title="Rules">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vote mode" hint={settings.voteMode === 'majority' ? t('needs more than half') : t('most votes wins')}>
            <Segmented value={settings.voteMode} onChange={(v) => onChange({ voteMode: v })} options={[{ value: 'plurality', label: t('Plurality') }, { value: 'majority', label: t('Majority') }]} />
          </Field>
          <Field label="Tie-break">
            <Segmented value={settings.tieRule} onChange={(v) => onChange({ tieRule: v })} options={[{ value: 'noElimination', label: t('No kill') }, { value: 'revote', label: t('Revote') }, { value: 'random', label: t('Random') }]} />
          </Field>
          <Toggle checked={!!settings.hardMode && playerCount >= HARD_MODE_MIN_PLAYERS} onChange={(v) => playerCount >= HARD_MODE_MIN_PLAYERS && onChange({ hardMode: v })} label="Hard mode" hint={playerCount >= HARD_MODE_MIN_PLAYERS ? 'Public traits; the Detective gets three clues, one is Mafia' : 'Needs at least 10 players'} />
          <Toggle checked={settings.trial} onChange={(v) => onChange({ trial: v })} label="Trial before execution" hint="The accused defends, then guilty or not guilty" />
          <Toggle checked={settings.lastWords} onChange={(v) => onChange({ lastWords: v })} label="Last words" hint="The dead leave one final message" />
          {settings.trial && <Field label="Defense time"><Stepper value={settings.defenseSeconds} min={10} max={120} step={5} format={fmtSec} onChange={(v) => onChange({ defenseSeconds: v })} /></Field>}
          {settings.trial && mode === 'online' && <Field label="Judgment time"><Stepper value={settings.judgmentSeconds} min={10} max={60} step={5} format={fmtSec} onChange={(v) => onChange({ judgmentSeconds: v })} /></Field>}
          <Toggle checked={settings.revealRolesOnDeath} onChange={(v) => onChange({ revealRolesOnDeath: v })} label="Reveal roles on death" />
          <Toggle checked={settings.allowSkipVote} onChange={(v) => onChange({ allowSkipVote: v })} label="Allow skipping the vote" />
          <Toggle checked={settings.firstNightKill} onChange={(v) => onChange({ firstNightKill: v })} label="Mafia can kill on night 1" />
          <Toggle checked={settings.doctorSelfHeal} onChange={(v) => onChange({ doctorSelfHeal: v })} label="Doctor may protect self" />
          <Toggle checked={settings.sheriffGuilt} onChange={(v) => onChange({ sheriffGuilt: v })} label="Sheriff dies if they shoot Town" />
          <Field label="Sheriff shots"><Stepper value={settings.sheriffShots} min={1} max={5} onChange={(v) => onChange({ sheriffShots: v })} /></Field>
          <Field label="Survivor vests"><Stepper value={settings.survivorVests} min={0} max={5} onChange={(v) => onChange({ survivorVests: v })} /></Field>
          {mode === 'online' && <Toggle checked={settings.mafiaChat} onChange={(v) => onChange({ mafiaChat: v })} label="Mafia night chat" />}
          {mode === 'local' && (
            <>
              <Toggle checked={settings.promptAllAtNight} onChange={(v) => onChange({ promptAllAtNight: v })} label="Prompt everyone at night" hint="Hides who has abilities" />
              <Toggle checked={settings.secretBallot} onChange={(v) => onChange({ secretBallot: v })} label="Secret ballot voting" hint="Pass-and-play votes vs. open table vote" />
            </>
          )}
        </div>
      </Panel>

      <Panel title="Random events">
        <Toggle checked={settings.randomEvents} onChange={(v) => onChange({ randomEvents: v })} label="Enable random events" hint="Blood Moon, Secret Ballot, Thick Fog and more" />
        {settings.randomEvents && (
          <div className="mt-3">
            <Field label="Event chance per phase" hint={`${Math.round(settings.eventChance * 100)}%`}>
              <input type="range" min={5} max={80} step={5} value={Math.round(settings.eventChance * 100)} onChange={(e) => onChange({ eventChance: Number(e.target.value) / 100 })} className="w-full accent-[rgb(var(--c-accent))]" />
            </Field>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.values(EVENTS).map((e) => (
                <span key={e.id} className="chip" title={t(e.description)}><Icon name={e.id} size={12} /> {t(e.name)}</span>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Map">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(['random', ...MAP_IDS] as const).map((id) => {
            const m = id === 'random' ? null : MAPS[id];
            const active = (settings.map ?? 'random') === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ map: id })}
                className={`flex flex-col items-start gap-1 border p-3 text-left transition ${active ? 'border-accent bg-accent/10 shadow-glow' : 'border-line/60 bg-ink/40 hover:border-accent/50'}`}
              >
                <Icon name={id} size={22} className={active ? 'text-accent' : 'text-muted'} />
                <span className="text-[12px] font-bold uppercase tracking-wider">{t(m ? m.name : 'Random')}</span>
                <span className="text-[11px] leading-snug text-muted">{t(m ? m.description : 'A different place every game.')}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted">{t('The map decides where bodies are found and how each victim was killed.')}</p>
      </Panel>

      <Panel title="Colour profile">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEMES.map((th) => (
            <button
              key={th.id}
              type="button"
              onClick={() => onChange({ theme: th.id })}
              className={`rounded-xl border p-3 text-left transition ${settings.theme === th.id ? 'border-accent bg-accent/15 shadow-glow' : 'border-line/50 bg-ink/40 hover:border-accent/50'}`}
            >
              <ThemeSwatch vars={th.vars} />
              <div className="mt-2 text-sm font-semibold">{t(th.name)}</div>
              <div className="text-[11px] text-muted">{t(th.description)}</div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function ThemeSwatch({ vars }: { vars: Record<string, string> }) {
  return (
    <div className="flex h-9 w-full items-end gap-[3px] border border-line bg-[#060607] p-1.5" aria-hidden>
      {[60, 90, 40, 75, 100, 55, 30, 85].map((h, i) => (
        <span key={i} className="flex-1" style={{ height: `${h}%`, background: `rgb(${i % 4 === 3 ? vars['--c-accent2'] : vars['--c-accent']})`, opacity: 0.35 + (h / 100) * 0.65 }} />
      ))}
    </div>
  );
}
