import type { ReactNode } from 'react';
import { type ThemePref, useThemePref } from './lib/theme';

const ICONS: Record<ThemePref, ReactNode> = {
  system: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  light: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  dark: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  ),
};

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System theme' },
  { value: 'light', label: 'Light theme' },
  { value: 'dark', label: 'Dark theme' },
];

export default function ThemeRocker() {
  const [pref, setPref] = useThemePref();

  return (
    <fieldset className="inline-flex items-center gap-0.5 rounded-lg border border-base-300 bg-base-200 p-0.5">
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map(({ value, label }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => setPref(value)}
            className={`grid size-7 place-items-center rounded-md transition-colors ${
              active
                ? 'bg-primary/15 text-primary'
                : 'text-base-content/55 hover:bg-base-content/10 hover:text-base-content'
            }`}
          >
            {ICONS[value]}
          </button>
        );
      })}
    </fieldset>
  );
}
