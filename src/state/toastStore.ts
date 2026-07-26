import { useMemo } from 'react';
import { create } from 'zustand';

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, variant?: ToastVariant, durationMs?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const DEFAULT_DURATION_MS = 2600;
/** More than this on screen and the newest one is off the top of the phone. */
const MAX_VISIBLE = 3;

let counter = 0;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],

  show: (message, variant = 'info', durationMs = DEFAULT_DURATION_MS) => {
    counter += 1;
    const id = `toast_${counter}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant, durationMs }].slice(-MAX_VISIBLE) }));

    if (typeof window !== 'undefined' && durationMs > 0) {
      window.setTimeout(() => get().dismiss(id), durationMs);
    }
    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export interface ToastApi {
  show: (message: string, variant?: ToastVariant) => void;
  info: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  dismiss: (id: string) => void;
}

/** Stable handle — safe to list in a hook dependency array. */
export function useToast(): ToastApi {
  return useMemo<ToastApi>(() => {
    const { show, dismiss } = useToastStore.getState();
    return {
      show: (message, variant) => void show(message, variant),
      info: (message) => void show(message, 'info'),
      success: (message) => void show(message, 'success'),
      error: (message) => void show(message, 'error'),
      dismiss,
    };
  }, []);
}
