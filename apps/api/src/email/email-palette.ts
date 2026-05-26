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
    accent: '#28537e',
    accentFg: '#f4f1ec',
    bg: '#f4f1ec',
    bgElevated: '#d4ccc0',
    bgSurface: '#e8e2d8',
    border: '#76636f',
    text: '#0d1426',
    textMuted: '#4f361a',
    textSubtle: '#493444',
  },
  'before-midnight': {
    accent: '#562315',
    accentFg: '#ffffff',
    bg: '#ccc095',
    bgElevated: '#a0c8b0',
    bgSurface: '#c2dada',
    border: '#11637a',
    text: '#20303d',
    textMuted: '#323223',
    textSubtle: '#2d3419',
  },
  'before-sunrise': {
    accent: '#623618',
    accentFg: '#f3ecd3',
    bg: '#f3ecd3',
    bgElevated: '#c8a870',
    bgSurface: '#dcc8a4',
    border: '#6e5624',
    text: '#341b0d',
    textMuted: '#2b1f0a',
    textSubtle: '#2c200b',
  },
  'before-sunset': {
    accent: '#7a3f15',
    accentFg: '#e8e5d7',
    bg: '#e8e5d7',
    bgElevated: '#b89030',
    bgSurface: '#d4b06a',
    border: '#6b4a18',
    text: '#050404',
    textMuted: '#2f221a',
    textSubtle: '#4a3015',
  },
  boyhood: {
    accent: '#5a2d29',
    accentFg: '#ffffff',
    bg: '#d0cf93',
    bgElevated: '#a8bc48',
    bgSurface: '#bcd068',
    border: '#536620',
    text: '#0d150d',
    textMuted: '#1e2a0a',
    textSubtle: '#252a15',
  },
  'dazed-and-confused': {
    accent: '#7e1f1f',
    accentFg: '#f3f0ed',
    bg: '#f3f0ed',
    bgElevated: '#d4b898',
    bgSurface: '#e79d7f',
    border: '#7a5518',
    text: '#2a201d',
    textMuted: '#421410',
    textSubtle: '#192526',
  },
  'hit-man': {
    accent: '#70180d',
    accentFg: '#ffffff',
    bg: '#f0c870',
    bgElevated: '#d09848',
    bgSurface: '#c4a860',
    border: '#7c421d',
    text: '#1a150e',
    textMuted: '#201508',
    textSubtle: '#1e1607',
  },
  'nouvelle-vague': {
    accent: '#1f1f1f',
    accentFg: '#f8f8f8',
    bg: '#f8f8f8',
    bgElevated: '#ebebeb',
    bgSurface: '#ffffff',
    border: '#878787',
    text: '#0f0f0f',
    textMuted: '#4a4a4a',
    textSubtle: '#4d4d4d',
  },
  'scanner-darkly': {
    accent: '#8f2610',
    accentFg: '#eeeedf',
    bg: '#eeeedf',
    bgElevated: '#d0bc78',
    bgSurface: '#e8d4a0',
    border: '#806023',
    text: '#0f0b1b',
    textMuted: '#4c2413',
    textSubtle: '#2f2b52',
  },
  'school-of-rock': {
    accent: '#5c1615',
    accentFg: '#ffffff',
    bg: '#e0d0c1',
    bgElevated: '#b69233',
    bgSurface: '#d4b07a',
    border: '#5e4517',
    text: '#000000',
    textMuted: '#040301',
    textSubtle: '#040301',
  },
};

export const resolveEmailPalette = (theme: string): EmailPalette =>
  palettes[theme] ?? palettes[FALLBACK_THEME];
