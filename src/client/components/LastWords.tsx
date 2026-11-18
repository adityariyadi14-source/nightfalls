import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ClientView } from '../../engine';
import { LAST_WORDS_MAX } from '../../engine';
import { Avatar } from './Avatar';
import { Button, Modal } from './ui';
import { Icon } from './Icon';
import { t } from '../lib/i18n';
import type { GameActions } from '../game/types';

/** A quoted last message, shown on case files and the verdict. */
export function LastWordsQuote({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <motion.blockquote initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-l-2 border-accent bg-ink/50 px-3 py-2 text-left text-[12.5px] italic leading-relaxed text-fg/90">
      <span className="not-italic text-[10px] font-bold uppercase tracking-[0.2em] text-accent">{t('Last words')}</span>
      <br />“{text}”
    </motion.blockquote>
  );
}

function Composer({ onSubmit, compact }: { onSubmit: (text: string) => void; compact?: boolean }) {
  const [text, setText] = useState('');
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSubmit(text.trim());
      }}
    >
      <textarea
        className="input min-h-[5.5rem] resize-none text-[13px]"
        maxLength={LAST_WORDS_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('Name your killer, share a clue, or say goodbye…')}
        aria-label={t('Last words')}
        autoFocus={!compact}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] tabular-nums text-muted">{text.length}/{LAST_WORDS_MAX}</span>
        <Button type="submit" size="sm" disabled={!text.trim()}>Leave last words</Button>
      </div>
    </form>
  );
}

/**
 * Online: the dead player writes their own last words.
 * Local: one button per newly dead player; the device is handed to them to write.
 */
export function LastWordsPrompt({ view, actions }: { view: ClientView; actions: GameActions }) {
  const [writer, setWriter] = useState<string | null>(null);
  if (!view.settings.lastWords) return null;

  if (actions.mode === 'online') {
    if (!view.me?.canLeaveLastWords) return null;
    return (
      <div className="glass mb-4 border-accent/70 p-4">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em] text-accent"><Icon name="skull" size={14} /> {t('You are dead. Leave your last words.')}</div>
        <p className="mb-3 text-[12px] text-muted">{t('Everyone will read this. You only get one message.')}</p>
        <Composer onSubmit={(x) => actions.lastWords(x)} compact />
      </div>
    );
  }

  // local: anyone who died during this day/night and has not written yet
  const pending = view.players.filter((p) => !p.alive && !p.lastWords && view.recentlyDead.includes(p.id));
  if (!pending.length) return null;
  const who = writer ? view.players.find((p) => p.id === writer) : null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {pending.map((p) => (
        <button key={p.id} type="button" onClick={() => setWriter(p.id)} className="flex items-center gap-2 border border-accent/70 bg-accent/5 px-3 py-2 text-[12px] font-bold uppercase tracking-wider hover:bg-accent/15">
          <Avatar index={p.avatar} photo={p.photo} size={24} ring={false} dead />
          {t('Last words: {name}', { name: p.name })}
        </button>
      ))}
      <Modal open={!!who} onClose={() => setWriter(null)} title={who ? t('Last words: {name}', { name: who.name }) : ''}>
        <p className="mb-3 text-[12px] text-muted">{t('Hand the device to {name}. Everyone will read this.', { name: who?.name ?? '' })}</p>
        <Composer
          onSubmit={(x) => {
            actions.lastWords(x, writer!);
            setWriter(null);
          }}
        />
      </Modal>
    </div>
  );
}
