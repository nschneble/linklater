import type { Catalogs, Manifest, ScanHit } from './fa-scan';

export interface SyncSummary {
  added: { brands: string[]; solid: string[] };
  removed: { brands: string[]; solid: string[] };
}

export interface ComputeNextManifestInput {
  hits: Map<string, ScanHit>;
  catalogs: Catalogs;
  currentManifest: Manifest;
}

export interface ComputeNextManifestResult {
  manifest: Manifest;
  summary: SyncSummary;
}

export type SyncErrorKind = 'unknown' | 'ambiguous';

export interface SyncErrorDetailUnknown {
  token: string;
  files: string[];
}

export interface SyncErrorDetailAmbiguous {
  name: string;
  files: string[];
}

export class SyncError extends Error {
  kind: SyncErrorKind;
  details: SyncErrorDetailUnknown[] | SyncErrorDetailAmbiguous[];
}

export function computeNextManifest(
  input: ComputeNextManifestInput,
): ComputeNextManifestResult;

export function serializeManifest(manifest: Manifest): string;
