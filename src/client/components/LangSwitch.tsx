import { usePrefs, setPrefs } from '../lib/prefs';
import { sfx } from '../lib/audio';

/** EN | ID language switch. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang } = usePrefs();
  return (
    <div className={`inline-flex border border-line text-[11px] font-bold tracking-wider ${className}`} role="group" aria-label="Language / Bahasa">
      {(['en', 'id'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => { sfx.select(); setPrefs({ lang: l }); }}
          className={`px-2 py-1 uppercase ${lang === l ? 'bg-accent text-ink' : 'text-muted hover:text-fg'}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
