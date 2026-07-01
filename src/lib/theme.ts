import { useCallback, useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';
const DARK_THEME = 'console';
const LIGHT_THEME = 'yc';

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** The concrete DaisyUI theme name a preference resolves to right now. */
export function resolveTheme(pref: ThemePref): string {
  if (pref === 'dark') return DARK_THEME;
  if (pref === 'light') return LIGHT_THEME;
  return prefersDark() ? DARK_THEME : LIGHT_THEME;
}

function applyTheme(pref: ThemePref): void {
  document.documentElement.dataset.theme = resolveTheme(pref);
}

function readThemePref(): ThemePref {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage unavailable; fall through to default
  }
  return 'system';
}

/** Theme preference state. Applies the resolved theme and, while on `system`,
 *  tracks the OS preference live. Persists the choice across reloads. */
export function useThemePref(): [ThemePref, (next: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readThemePref);

  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  const update = useCallback((next: ThemePref) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // preference simply won't persist
    }
    setPref(next);
  }, []);

  return [pref, update];
}
