import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';

export const EDITABLE_VARS = [
  '--bg',
  '--bg-surface',
  '--bg-elevated',
  '--bg-input',
  '--text',
  '--text-muted',
  '--text-subtle',
  '--border',
  '--accent',
  '--accent-fg',
] as const;

export type ThemeVariable = (typeof EDITABLE_VARS)[number];

export const VAR_GROUPS: Array<{
  label: string;
  items: Array<{ variable: ThemeVariable; label: string }>;
}> = [
  {
    label: 'Backgrounds',
    items: [
      { variable: '--bg', label: 'Base' },
      { variable: '--bg-surface', label: 'Surface' },
      { variable: '--bg-elevated', label: 'Elevated' },
      { variable: '--bg-input', label: 'Input' },
    ],
  },
  {
    label: 'Text',
    items: [
      { variable: '--text', label: 'Primary' },
      { variable: '--text-muted', label: 'Muted' },
      { variable: '--text-subtle', label: 'Subtle' },
    ],
  },
  {
    label: 'Border',
    items: [{ variable: '--border', label: 'Border' }],
  },
  {
    label: 'Accent',
    items: [
      { variable: '--accent', label: 'Primary' },
      { variable: '--accent-fg', label: 'Foreground' },
    ],
  },
];

function readAllComputedVars(): Record<ThemeVariable, string> {
  const computedStyle = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    EDITABLE_VARS.map((variable) => [
      variable,
      computedStyle.getPropertyValue(variable).trim(),
    ])
  ) as Record<ThemeVariable, string>;
}

function clearAllInlineOverrides(): void {
  const root = document.documentElement;
  for (const variable of EDITABLE_VARS) {
    root.style.removeProperty(variable);
  }
}

export function useThemeOverrides() {
  const { baseTheme, mode } = useTheme();
  const [colorValues, setColorValues] = useState<Record<ThemeVariable, string>>(
    readAllComputedVars
  );

  useEffect(() => {
    clearAllInlineOverrides();
    setColorValues(readAllComputedVars());
  }, [baseTheme, mode]);

  useEffect(() => {
    return clearAllInlineOverrides;
  }, []);

  const setOverride = useCallback((variable: ThemeVariable, value: string) => {
    document.documentElement.style.setProperty(variable, value);
    setColorValues((previous) => ({ ...previous, [variable]: value }));
  }, []);

  const resetOverrides = useCallback(() => {
    clearAllInlineOverrides();
    setColorValues(readAllComputedVars());
  }, []);

  return { colorValues, setOverride, resetOverrides };
}
