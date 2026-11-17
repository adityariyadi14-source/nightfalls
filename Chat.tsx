import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../engine';
import { t } from '../lib/i18n';
import { sfx } from '../lib/audio';

export function Chat({
  messages,
  channel,
  onSend,
  disabled,
  placeholder,
  meId,
  className = ''
}: {
  messages: ChatMessage[];
  channel: 'public' | 'mafia' | 'dead';
  onSend: (text: string) => void;
  disabled?: string | false;
  placeholder?: string;
  meId?: string | null;
  className?: string;
}) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const list = messages.filter((m) => m.channel === channel);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
    if (list.length && list[list.length - 1].from !== meId && list[list.length - 1].from !== 'system') sfx.hover();
  }, [list.length]);
  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  };
  const tint = channel === 'mafia' ? 'border-danger/40' : channel === 'dead' ? 'border-zinc-500/40' : 'border-line/50';
  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div ref={ref} className="scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {list.length === 0 && <p className="py-6 text-center text-xs text-muted">{t(channel === 'mafia' ? 'Whisper to your allies.' : channel === 'dead' ? 'The dead can speak freely here.' : 'Say something to the town.')}</p>}
        {list.map((m) => (
          <div key={m.id} className={`rounded-lg px-2 py-1 text-sm ${m.from === 'system' ? 'italic text-muted' : m.from === meId ? 'bg-accent/10' : 'bg-ink/40'}`}>
            {m.from !== 'system' && <span className="mr-1.5 font-semibold text-accent2">{m.name}</span>}
            <span className="break-words">{m.text}</span>
          </div>
        ))}
      </div>
      <form
        className={`mt-2 flex gap-2 rounded-xl border bg-ink/60 p-1 ${tint}`}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!!disabled}
          maxLength={280}
          placeholder={t(disabled || placeholder || 'Message…')}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted/60 disabled:opacity-60"
        />
        <button type="submit" disabled={!!disabled || !text.trim()} className="rounded-lg bg-accent px-3 text-sm font-semibold text-ink disabled:opacity-40">
          {t("Send")}
        </button>
      </form>
    </div>
  );
}
