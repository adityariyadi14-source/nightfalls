import { motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { Button } from './ui';
import { Icon } from './Icon';
import { t } from '../lib/i18n';
import { sfx } from '../lib/audio';

export function PassDevice({ name, avatar, photo, what, onReady }: { name: string; avatar: number; photo?: string; what: string; onReady: () => void }) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass w-full max-w-sm p-7">
        <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-accent">
          <Icon name="lock" size={13} /> {t("Secure handoff")}
        </div>
        <p className="mt-5 text-[12px] uppercase tracking-[0.2em] text-muted">{t("Pass the device to")}</p>
        <div className="my-5 flex justify-center">
          <Avatar index={avatar} photo={photo} size={96} />
        </div>
        <h2 className="title glitch text-6xl">{name}</h2>
        <p className="mt-3 text-[13px] text-fg/80">{t(what)}</p>
        <p className="mt-6 border-y border-line/60 py-2 text-[11px] uppercase tracking-[0.2em] text-danger">{t("Everyone else, look away")}</p>
        <Button size="lg" className="mt-6 w-full" onClick={() => { sfx.whoosh(); onReady(); }}>
          {t("I'm {name}, show me", { name })}
        </Button>
      </motion.div>
    </div>
  );
}
