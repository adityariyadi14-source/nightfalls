import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';
import { sfx } from '../lib/audio';
import { t } from '../lib/i18n';
import { Icon } from './Icon';

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
  type = 'button',
  size = 'md',
  title
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  size?: 'sm' | 'md' | 'lg';
  title?: string;
}) {
  const sizeCls = size === 'sm' ? '!px-3 !py-1.5 !text-[11px]' : size === 'lg' ? '!px-7 !py-4 !text-[15px]' : '';
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={() => {
        sfx.click();
        onClick?.();
      }}
      className={`btn-${variant} ${sizeCls} ${className}`}
    >
      {typeof children === 'string' ? t(children) : children}
    </button>
  );
}

export function Panel({ children, className = '', title, right }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode }) {
  return (
    <section className={`glass p-4 sm:p-5 ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line/50 pb-2">
          {title && <h3 className="label">{typeof title === 'string' ? t(title) : title}</h3>}
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="label">{t(label)}</span>
        {hint && <span className="text-[11px] text-muted/80">{t(hint)}</span>}
      </div>
      {children}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        sfx.select();
        onChange(!checked);
      }}
      className={`flex w-full items-center justify-between gap-3 border px-3 py-2.5 text-left transition ${checked ? 'border-accent/60 bg-accent/5' : 'border-line/60 bg-ink/40 hover:border-line'}`}
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{t(label)}</span>
        {hint && <span className="block text-[11px] text-muted">{t(hint)}</span>}
      </span>
      <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[11px] font-bold ${checked ? 'border-accent bg-accent text-ink' : 'border-line text-muted'}`}>{checked ? t('ON') : t('OFF')}</span>
    </button>
  );
}

export function Stepper({ value, onChange, min, max, step = 1, format }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string }) {
  const btn = 'h-8 w-8 border border-line bg-ink/60 font-bold hover:border-accent hover:text-accent disabled:opacity-25';
  return (
    <div className="flex items-center">
      <button type="button" className={btn} disabled={value <= min} onClick={() => { sfx.click(); onChange(Math.max(min, value - step)); }} aria-label="Decrease">−</button>
      <span className="h-8 min-w-[3.75rem] border-y border-line bg-ink/40 px-1 text-center text-[13px] font-bold leading-8 tabular-nums">{format ? format(value) : value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => { sfx.click(); onChange(Math.min(max, value + step)); }} aria-label="Increase">+</button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="flex border border-line bg-ink/60">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => { sfx.select(); onChange(o.value); }}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-bold uppercase tracking-wider transition ${value === o.value ? 'bg-accent text-ink' : 'text-muted hover:text-fg'}`}
        >
          {typeof o.label === 'string' ? t(o.label) : o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="glass w-full max-w-lg p-5" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ duration: 0.18 }} onClick={(e) => e.stopPropagation()}>
            {title && <h3 className="title mb-4 text-2xl">{t(title)}</h3>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Page({ children, className = '', wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className={`mx-auto w-full ${wide ? 'max-w-6xl' : 'max-w-3xl'} px-4 pb-8 pt-5 sm:px-6 safe-pad ${className}`}
    >
      {children}
    </motion.main>
  );
}

export function TopBar({ title, onBack, right }: { title?: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-4">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button onClick={() => { sfx.click(); onBack(); }} className="flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-ink/60 hover:border-accent hover:text-accent" aria-label="Back">
            <Icon name="back" />
          </button>
        )}
        {title && <h1 className="title min-w-0 text-3xl sm:text-4xl">{typeof title === 'string' ? t(title) : title}</h1>}
      </div>
      {right}
    </div>
  );
}
