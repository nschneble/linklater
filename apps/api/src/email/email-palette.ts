// @generated – don't edit. Run: node scripts/generate-email-palette.mjs

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
    accentFg: '#ffffff',
    bg: '#f4f1ec',
    bgElevated: '#d4ccc0',
    bgSurface: '#e8e2d8',
    border: '#76636f',
    text: '#0d1426',
    textMuted: '#4f361a',
    textSubtle: '#493444',
  },
  'before-midnight': {
    accent: '#a04a30',
    accentFg: '#ffffff',
    bg: '#ccc095',
    bgElevated: '#e3d9b9',
    bgSurface: '#d8cda8',
    border: '#11637a',
    text: '#20303d',
    textMuted: '#2d3419',
    textSubtle: '#2d3419',
  },
  'before-sunrise': {
    accent: '#8a4520',
    accentFg: '#ffffff',
    bg: '#f3ecd3',
    bgElevated: '#ddcfa0',
    bgSurface: '#e8dcb8',
    border: '#5a3018',
    text: '#1a0e08',
    textMuted: '#341b0d',
    textSubtle: '#2c200b',
  },
  'before-sunset': {
    accent: '#7a3f15',
    accentFg: '#ffffff',
    bg: '#e8e5d7',
    bgElevated: '#d2cdb6',
    bgSurface: '#ddd8c4',
    border: '#5e4227',
    text: '#050404',
    textMuted: '#2f221a',
    textSubtle: '#4a3015',
  },
  boyhood: {
    accent: '#5a2d29',
    accentFg: '#ffffff',
    bg: '#d0cf93',
    bgElevated: '#e2dfb0',
    bgSurface: '#dad8a0',
    border: '#335215',
    text: '#0d150d',
    textMuted: '#2d3414',
    textSubtle: '#252a15',
  },
  'dazed-and-confused': {
    accent: '#a15144',
    accentFg: '#f3f0ed',
    bg: '#f3f0ed',
    bgElevated: '#e3dcd2',
    bgSurface: '#ebe6df',
    border: '#5d7984',
    text: '#2a201d',
    textMuted: '#4a3a32',
    textSubtle: '#192526',
  },
  'hit-man': {
    accent: '#7c421d',
    accentFg: '#ffffff',
    bg: '#ecdcb0',
    bgElevated: '#ddc888',
    bgSurface: '#e5d39c',
    border: '#4e2c14',
    text: '#1a150e',
    textMuted: '#4e2c14',
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
    bgElevated: '#ddd6c0',
    bgSurface: '#e6e2d0',
    border: '#3b376a',
    text: '#0f0b1b',
    textMuted: '#4c2413',
    textSubtle: '#2f2b52',
  },
  'school-of-rock': {
    accent: '#a32010',
    accentFg: '#ffffff',
    bg: '#e0d0c1',
    bgElevated: '#f6ead7',
    bgSurface: '#f0e2cd',
    border: '#7a5a30',
    text: '#0a0a07',
    textMuted: '#3e2810',
    textSubtle: '#040301',
  },
};

export const resolveEmailPalette = (theme: string): EmailPalette =>
  palettes[theme] ?? palettes[FALLBACK_THEME];
