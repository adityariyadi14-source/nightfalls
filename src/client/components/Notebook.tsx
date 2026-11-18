import type { ClientView } from '../../engine';
import { Panel } from './ui';
import { Icon } from './Icon';
import { t } from '../lib/i18n';

/** The Detective's private notebook: every night's finding, kept for the rest of the game. */
export function DetectiveNotebook({ view }: { view: ClientView }) {
  const me = view.me;
  if (!me || me.role !== 'detective' || !me.notebook.length) return null;
  return (
    <Panel title="Detective notebook" right={<span className="chip"><Icon name="lock" size={11} /> {t('only you')}</span>}>
      <ol className="space-y-1.5 font-mono text-[12px]">
        {me.notebook.map((n) => {
          const target = n.targetId ? view.players.find((p) => p.id === n.targetId) : null;
          return (
            <li key={n.night} className="grid grid-cols-[3.5rem_1fr] gap-2">
              <span className="text-muted">{t('Night {n}', { n: n.night })}</span>
              {n.clues ? (
                <span className="flex flex-wrap gap-1">
                  {n.clues.map((c) => <span key={c} className="border border-accent2/60 px-1.5 text-accent2">{t(c)}</span>)}
                </span>
              ) : target && n.result ? (
                <span>
                  {target.name} → <strong className={n.result === 'suspicious' ? 'text-danger' : 'text-accent2'}>{t(n.result === 'suspicious' ? 'SUSPICIOUS' : 'INNOCENT')}</strong>
                </span>
              ) : (
                <span className="text-muted">{t('No findings.')}</span>
              )}
            </li>
          );
        })}
      </ol>
      {view.settings.hardMode && <p className="mt-2 text-[11px] text-muted">{t('Each set of clues hints at three players. Exactly one of them is Mafia.')}</p>}
    </Panel>
  );
}

/** Dawn reveal of the three clue words (hard mode). */
export function ClueReveal({ clues }: { clues: string[] }) {
  return (
    <div className="mx-auto mt-4 max-w-md border border-accent2/60 bg-accent2/5 p-3 text-left">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-accent2"><Icon name="detective" size={14} /> {t('Evidence found')}</div>
      <div className="grid grid-cols-3 gap-2">
        {clues.map((c, i) => (
          <div key={i} className="border border-accent2/50 bg-ink px-2 py-3 text-center font-mono text-[13px] font-bold uppercase tracking-wider text-fg">{t(c)}</div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">{t('Each word hints at one player’s trait. Exactly one of the three is Mafia. Only you can see this.')}</p>
    </div>
  );
}
