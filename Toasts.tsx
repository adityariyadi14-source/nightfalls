import { AnimatePresence, motion } from 'framer-motion';
import { t } from '../lib/i18n';
import { useToasts } from '../lib/toast';

export function Toasts() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[70] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((x) => (
          <motion.div
            key={x.id}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`glass rounded-xl px-4 py-2.5 text-sm font-medium shadow-card ${x.kind === 'error' ? 'border-danger/60 text-danger' : x.kind === 'success' ? 'border-accent2/60' : x.kind === 'warn' ? 'border-amber-400/60' : ''}`}
          >
            {t(x.text)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
