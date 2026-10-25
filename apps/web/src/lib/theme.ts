import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

export const useTheme = create<ThemeState>()(persist((set) => ({ mode: 'system', setMode: (mode) => set({ mode }) }), { name: 'kreators.theme' }));

const LIGHT = '#262626';
const DARK = '#121212';

/** Writes the chosen mode onto <html> and keeps the browser chrome color in step. */
export function useApplyTheme(): void {
  const mode = useTheme((s) => s.mode);
  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'system') delete root.dataset.theme;
    else root.dataset.theme = mode;
    const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? DARK : LIGHT);
  }, [mode]);
}
