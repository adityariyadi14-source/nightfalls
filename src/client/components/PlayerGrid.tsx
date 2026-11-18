import { motion } from 'framer-motion';
import type { PublicPlayer } from '../../engine';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';
import { Icon } from './Icon';
import { t } from '../lib/i18n';
import { traitById } from '../../engine';
import { sfx } from '../lib/audio';

export function PlayerCard({
  p,
  selected,
  onSelect,
  disabled,
  badge,
  footer,
  meId,
  small,
  highlight
}: {
  p: PublicPlayer;
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  meId?: string | null;
  small?: boolean;
  highlight?: string;
}) {
  const selectable = !!onSelect && !disabled;
  return (
    <motion.div
      layout
      whileTap={selectable ? { scale: 0.97 } : undefined}
      onClick={() => {
        if (selectable) {
          sfx.select();
          onSelect!();
        }
      }}
      className={`card-player ${selectable ? 'selectable' : ''} ${selected ? 'selected' : ''} ${!p.alive ? 'dead' : ''} ${small ? '!p-2' : ''}`}
      style={highlight ? { borderColor: highlight, boxShadow: `0 0 24px -6px ${highlight}` } : undefined}
    >
      <div className="relative">
        <Avatar index={p.avatar} photo={p.photo} size={small ? 40 : 56} dead={!p.alive} />
        {!p.alive && <span className="absolute -left-1.5 -top-1.5 border border-danger bg-ink p-0.5 text-danger"><Icon name="skull" size={small ? 10 : 12} /></span>}
        {p.alive && p.silenced && <span className="absolute -right-2 -top-2 border border-fuchsia-400 bg-ink p-0.5 text-fuchsia-300" title="Silenced"><Icon name="mute" size={12} /></span>}
        <span className={`absolute -bottom-1 -right-1 h-2.5 w-2.5 border border-ink ${p.connected ? 'bg-accent2' : 'bg-zinc-600'}`} title={p.connected ? 'Connected' : 'Disconnected'} />
      </div>
      <div className="flex max-w-full items-center gap-1">
        <span className={`truncate ${small ? 'text-[11px]' : 'text-[13px]'} font-bold uppercase tracking-wide`}>{p.name}</span>
        {p.isHost && <span title="Host" className="text-accent"><Icon name="crown" size={12} /></span>}
      </div>
      {p.id === meId && <span className="chip !py-0 !text-[9px]">{t("you")}</span>}
      {!p.alive && <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-danger">{t("deceased")}</span>}
      {p.trait && <span className="line-clamp-2 max-w-full text-[10px] italic leading-tight text-accent2/90" title={t(traitById(p.trait)?.label ?? '')}>{t(traitById(p.trait)?.label ?? '')}</span>}
      {p.role && <RoleBadge role={p.role} />}
      {badge}
      {footer}
    </motion.div>
  );
}

export function PlayerGrid({ children, cols }: { children: React.ReactNode; cols?: string }) {
  return <div className={`grid gap-2 sm:gap-3 ${cols ?? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'}`}>{children}</div>;
}
