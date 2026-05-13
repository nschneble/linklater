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
  'before-midnight': {
    accent: '#b75638',
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
    textMuted: '#7a5020',
    textSubtle: '#9a6840',
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
    accent: '#b25e59',
    accentFg: '#ffffff',
    bg: '#d0cf93',
    bgElevated: '#a8bc48',
    bgSurface: '#bcd068',
    border: '#637628',
    text: '#0d150d',
    textMuted: '#335215',
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
    textMuted: '#a15144',
    textSubtle: '#596f78',
  },
  'hit-man': {
    accent: '#cc310d',
    accentFg: '#ffffff',
    bg: '#f0c870',
    bgElevated: '#a07830',
    bgSurface: '#c4a860',
    border: '#7c421d',
    text: '#1a150e',
    textMuted: '#4e2c14',
    textSubtle: '#5a3c20',
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
    textMuted: '#4c310b',
    textSubtle: '#6a4820',
  },
};

export const resolveEmailPalette = (theme: string): EmailPalette =>
  palettes[theme] ?? palettes[FALLBACK_THEME];
