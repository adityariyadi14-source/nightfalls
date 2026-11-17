import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ClientView } from '../../engine';
import { ROLES } from '../../engine';
import { RoleCard } from '../components/RoleBadge';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/ui';
import { Timer } from '../components/Timer';
import { t } from '../lib/i18n';
import type { GameActions } from './types';

export function RoleRevealScreen({ view, actions }: { view: ClientView; actions: GameActions }) {
  const [flipped, setFlipped] = useState(false);
  const me = view.me!;
  const acked = view.revealAcks.includes(me.id);
  const allies = view.players.filter((p) => me.allies.includes(p.id));
  const waiting = view.players.filter((p) => p.connected && !view.revealAcks.includes(p.id)).length;

  return (
    <div className="flex flex-col items-center px-4 pb-8 pt-6">
      {actions.mode === 'online' && <div className="mb-4 w-full max-w-sm"><Timer endsAt={view.phaseEndsAt} startedAt={view.phaseStartedAt} offset={actions.clockOffset} label={t("Reveal ends in")} /></div>}
      <RoleCard role={me.role} onRevealed={() => setFlipped(true)} />
      <motion.div className="mt-6 w-full max-w-sm space-y-3" initial={{ opacity: 0 }} animate={{ opacity: flipped ? 1 : 0 }} transition={{ delay: 0.5 }}>
        {allies.length > 0 && (
          <div className="glass p-4">
            <p className="label mb-2">{t("Your allies")}</p>
            <div className="flex flex-wrap gap-3">
              {allies.map((a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <Avatar index={a.avatar} photo={a.photo} size={36} />
                  <div>
                    <div className="text-sm font-semibold">{a.name}</div>
                    <div className="text-[11px] uppercase tracking-wider" style={{ color: a.role ? ROLES[a.role].color : undefined }}>{a.role ? t(ROLES[a.role].name) : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {me.role === 'detective' && <p className="text-center text-xs text-muted">{t("Tip: the Godfather appears innocent. Cross-check with voting behaviour.")}</p>}
        {actions.mode === 'local' ? (
          <Button size="lg" className="w-full" disabled={!flipped} onClick={() => actions.done?.()}>
            {t("Got it \u2014 hide my role")}
          </Button>
        ) : acked ? (
          <div className="text-center text-sm text-muted">{t(waiting === 1 ? 'Waiting for {n} player…' : 'Waiting for {n} players…', { n: waiting })}</div>
        ) : (
          <Button size="lg" className="w-full" disabled={!flipped} onClick={() => actions.ackReveal()}>
            {t("I'm ready")}
          </Button>
        )}
      </motion.div>
    </div>
  );
}
