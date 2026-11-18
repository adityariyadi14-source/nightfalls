import { useSyncExternalStore } from 'react';
import { sfx } from './audio';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'warn' | 'success' | 'error';
}
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3500) {
  const id = nextId++;
  toasts = [...toasts, { id, text, kind }].slice(-5);
  emit();
  if (kind === 'error') sfx.error();
  else sfx.notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, ms);
}

export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts
  );
}
