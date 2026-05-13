// @generated — do not edit by hand. Run: node scripts/generate-email-palette.mjs

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_DIR = join(ROOT, 'apps/web/src/theme/styles');
const OUTPUT_PATH = join(ROOT, 'apps/api/src/email/email-palette.ts');
const FALLBACK_THEME = 'scanner-darkly';

const CSS_VAR_TO_PALETTE_KEY = {
  accent: 'accent',
  'accent-fg': 'accentFg',
  bg: 'bg',
  'bg-elevated': 'bgElevated',
  'bg-surface': 'bgSurface',
  border: 'border',
  text: 'text',
  'text-muted': 'textMuted',
  'text-subtle': 'textSubtle',
};

const EXPECTED_CSS_VARS = Object.keys(CSS_VAR_TO_PALETTE_KEY);

function parseTheme(filePath, content) {
  const lightBlockMatch = content.match(
    /\[data-theme='([^']+)'\]\[data-mode='light'\]\s*\{([^}]+)\}/,
  );
  if (!lightBlockMatch) return null;

  const themeName = lightBlockMatch[1];
  const blockContent = lightBlockMatch[2];
  const palette = {};

  const varPattern = /--([a-z-]+):\s*(#[0-9a-fA-F]+)/g;
  let match;
  while ((match = varPattern.exec(blockContent)) !== null) {
    const cssVar = match[1];
    const value = match[2];
    if (cssVar in CSS_VAR_TO_PALETTE_KEY) {
      palette[CSS_VAR_TO_PALETTE_KEY[cssVar]] = value;
    }
  }

  for (const cssVar of EXPECTED_CSS_VARS) {
    const paletteKey = CSS_VAR_TO_PALETTE_KEY[cssVar];
    if (!palette[paletteKey]) {
      throw new Error(`Missing --${cssVar} in light-mode block of ${filePath}`);
    }
  }

  return { themeName, palette };
}

function buildOutput(themes) {
  const sorted = [...themes].sort((a, b) =>
    a.themeName.localeCompare(b.themeName),
  );

  const paletteBlock = sorted
    .map(({ themeName, palette }) => {
      const pairs = Object.keys(palette)
        .sort()
        .map((key) => `    ${key}: '${palette[key]}',`)
        .join('\n');
      return `  '${themeName}': {\n${pairs}\n  },`;
    })
    .join('\n');

  return [
    `// @generated — do not edit by hand. Run: node scripts/generate-email-palette.mjs`,
    ``,
    `export interface EmailPalette {`,
    `  accent: string;`,
    `  accentFg: string;`,
    `  bg: string;`,
    `  bgElevated: string;`,
    `  bgSurface: string;`,
    `  border: string;`,
    `  text: string;`,
    `  textMuted: string;`,
    `  textSubtle: string;`,
    `}`,
    ``,
    `const FALLBACK_THEME = '${FALLBACK_THEME}';`,
    ``,
    `const palettes: Record<string, EmailPalette> = {`,
    paletteBlock,
    `};`,
    ``,
    `export const resolveEmailPalette = (theme: string): EmailPalette =>`,
    `  palettes[theme] ?? palettes[FALLBACK_THEME];`,
    ``,
  ].join('\n');
}

const cssFiles = readdirSync(CSS_DIR)
  .filter((file) => file.endsWith('.css'))
  .map((file) => join(CSS_DIR, file));

const themes = cssFiles
  .map((filePath) => parseTheme(filePath, readFileSync(filePath, 'utf-8')))
  .filter(Boolean);

if (themes.length === 0) {
  throw new Error(`No theme CSS files found in ${CSS_DIR}`);
}

writeFileSync(OUTPUT_PATH, buildOutput(themes), 'utf-8');
console.log(`Generated ${OUTPUT_PATH} (${themes.length} themes).`);
