// Type declarations for fa-scan.mjs. Lets the TypeScript test files import
// the shared scanner without `// @ts-expect-error` litter.

export interface ScanHit {
  token: string;
  files: Set<string>;
}

export interface Catalogs {
  solid: Set<string>;
  brands: Set<string>;
}

export interface Manifest {
  brands: string[];
  regular: string[];
  solid: string[];
}

export interface Paths {
  webRoot: string;
  srcRoot: string;
  indexHtml: string;
  manifestPath: string;
  brandsCssPath: string;
  regularCssPath: string;
  solidCssPath: string;
}

export const paths: Paths;
export const NON_ICON_UTILITY_PREFIXES: Set<string>;
export function parseCodepoints(cssFile: string): Promise<Map<string, number>>;
export function parseIconNames(cssFile: string): Promise<Set<string>>;
export function loadCatalogs(): Promise<Catalogs>;
export function scanSources(): Promise<Map<string, ScanHit>>;
export function scanRegularNames(): Promise<Set<string>>;
export function loadManifest(): Promise<Manifest>;
