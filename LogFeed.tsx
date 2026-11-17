import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { t } from '../lib/i18n';
import type { LogEntry } from '../../engine';

const TAG: Record<LogEntry['kind'], string> = { info: 'INFO', death: 'KILL', vote: 'VOTE', event: 'EVNT', phase: 'SYS ', win: 'END ' };
const TONE: Record<LogEntry['kind'], string> = { info: 'text-fg/85', death: 'text-danger', vote: 'text-fg', event: 'text-accent2', phase: 'text-muted', win: 'text-accent' };

const hhmm = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/** The game chronicle, printed as a terminal log. */
export function LogFeed({ log, limit = 40, className = '' }: { log: LogEntry[]; limit?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = log.slice(-limit);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [log.length]);
  return (
    <div ref={ref} className={`scrollbar-thin max-h-56 space-y-0.5 overflow-y-auto pr-1 font-mono text-[12px] leading-relaxed ${className}`}>
      <AnimatePresence initial={false}>
        {items.map((l) => (
          <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`grid grid-cols-[auto_auto_1fr] gap-2 ${l.kind === 'death' ? 'bg-danger/10' : ''} px-1`}>
            <span className="text-muted/60 tabular-nums">{hhmm(l.ts)}</span>
            <span className={`font-bold ${l.kind === 'death' ? 'text-danger' : l.kind === 'event' ? 'text-accent2' : 'text-accent'}`}>[{TAG[l.kind]}]</span>
            <span className={`min-w-0 break-words ${TONE[l.kind]}`}>{t(l.text)}</span>
          </motion.div>
        ))}
      </AnimatePresence>
      {items.length === 0 && <p className="text-muted">{'> '}{t("no entries yet")}</p>}
    </div>
  );
}
