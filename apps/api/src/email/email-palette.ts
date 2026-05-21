// @generated — do not edit by hand. Run: node scripts/generate-email-palette.mjs

export interface EmailPalette {
  accent: string;
  accentFg: string;
  bg: string;
  bgElevated: string;
  bgSurface: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
}

const FALLBACK_THEME = 'scanner-darkly';

const palettes: Record<string, EmailPalette> = {
  'apollo-10-1-2': {
    accent: '#345f96',
    accentFg: '#f4f1ec',
    bg: '#f4f1ec',
    bgElevated: '#d4ccc0',
    bgSurface: '#e8e2d8',
    border: '#76636f',
    text: '#0d1426',
    textMuted: '#4f361a',
    textSubtle: '#5a4555',
  },
  'before-midnight': {
    accent: '#a84c30',
    accentFg: '#ffffff',
    bg: '#ccc095',
    bgElevated: '#a0c8b0',
    bgSurface: '#c2dada',
    border: '#11637a',
    text: '#20303d',
    textMuted: '#4e4435',
    textSubtle: '#3c5228',
  },
  'before-sunrise': {
    accent: '#8e4c22',
    accentFg: '#f3ecd3',
    bg: '#f3ecd3',
    bgElevated: '#c8a870',
    bgSurface: '#dcc8a4',
    border: '#d5b886',
    text: '#5a2e1a',
    textMuted: '#553a10',
    textSubtle: '#6e4828',
  },
  'before-sunset': {
    accent: '#874b1d',
    accentFg: '#e8e5d7',
    bg: '#e8e5d7',
    bgElevated: '#b89030',
    bgSurface: '#d4b06a',
    border: '#9a7030',
    text: '#050404',
    textMuted: '#2f221a',
    textSubtle: '#5a3a18',
  },
  boyhood: {
    accent: '#a85450',
    accentFg: '#ffffff',
    bg: '#d0cf93',
    bgElevated: '#a8bc48',
    bgSurface: '#bcd068',
    border: '#637628',
    text: '#0d150d',
    textMuted: '#2e4a12',
    textSubtle: '#385028',
  },
  'dazed-and-confused': {
    accent: '#d4212b',
    accentFg: '#f3f0ed',
    bg: '#f3f0ed',
    bgElevated: '#d4b898',
    bgSurface: '#e79d7f',
    border: '#c07818',
    text: '#2a201d',
    textMuted: '#6a2820',
    textSubtle: '#2a3c48',
  },
  'hit-man': {
    accent: '#cc310d',
    accentFg: '#ffffff',
    bg: '#f0c870',
    bgElevated: '#d09848',
    bgSurface: '#c4a860',
    border: '#7c421d',
    text: '#1a150e',
    textMuted: '#4e2c14',
    textSubtle: '#543818',
  },
  'nouvelle-vague': {
    accent: '#1f1f1f',
    accentFg: '#f8f8f8',
    bg: '#f8f8f8',
    bgElevated: '#ebebeb',
    bgSurface: '#ffffff',
    border: '#d0d0d0',
    text: '#0f0f0f',
    textMuted: '#4a4a4a',
    textSubtle: '#656565',
  },
  'scanner-darkly': {
    accent: '#a73210',
    accentFg: '#eeeedf',
    bg: '#eeeedf',
    bgElevated: '#d0bc78',
    bgSurface: '#e8d4a0',
    border: '#9a7030',
    text: '#0f0b1b',
    textMuted: '#64301a',
    textSubtle: '#3b376a',
  },
  'school-of-rock': {
    accent: '#e02a15',
    accentFg: '#ffffff',
    bg: '#e0d0c1',
    bgElevated: '#b08c30',
    bgSurface: '#d4b07a',
    border: '#8a5e28',
    text: '#0a0a07',
    textMuted: '#3c2408',
    textSubtle: '#5a3c18',
  },
};

export const resolveEmailPalette = (theme: string): EmailPalette =>
  palettes[theme] ?? palettes[FALLBACK_THEME];
