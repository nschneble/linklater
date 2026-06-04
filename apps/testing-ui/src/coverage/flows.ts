import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StoryFile } from '../schema/load.ts';

export interface FlowCoverage {
  total: number;
  covered: number;
  ratio: number;
  missing: string[];
}

const FLOWS_DOC = join('local', 'tuffgal', 'stories.md');

/**
 * Compares the journeys catalogued in `local/tuffgal/stories.md` (the
 * canonical inventory of user flows) with the stories under
 * `stories/`. A story is counted as covering a journey when its `flow`
 * field matches a journey row (case- and whitespace-insensitive).
 *
 * Returns 1.0 coverage when the inventory cannot be read so a fresh
 * checkout with no inventory yet does not break the report.
 */
export async function computeFlowCoverage(
  repoRoot: string,
  stories: StoryFile[],
): Promise<FlowCoverage> {
  const inventoryPath = join(repoRoot, FLOWS_DOC);
  let raw: string;
  try {
    raw = await readFile(inventoryPath, 'utf8');
  } catch {
    return { total: 0, covered: 0, ratio: 1, missing: [] };
  }
  const journeys = parseJourneyTable(raw);
  const claimed = new Set(
    stories
      .map((entry) => entry.story.flow)
      .filter((flow): flow is string => typeof flow === 'string')
      .map((flow) => normalise(flow)),
  );
  const missing: string[] = [];
  for (const journey of journeys) {
    if (!claimed.has(normalise(journey))) {
      missing.push(journey);
    }
  }
  const total = journeys.length;
  const covered = total - missing.length;
  return {
    total,
    covered,
    ratio: total === 0 ? 1 : covered / total,
    missing,
  };
}

/**
 * Pulls the first column of every body row from the first markdown table
 * in the document. Skips the header row and the dash separator row. The
 * inventory contains one row per journey, so this is the journey list.
 */
function parseJourneyTable(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const journeys: string[] = [];
  let insideTable = false;
  let skippedHeaderAndSeparator = 0;
  for (const line of lines) {
    if (!line.startsWith('|')) {
      if (insideTable) break;
      continue;
    }
    insideTable = true;
    if (skippedHeaderAndSeparator < 2) {
      skippedHeaderAndSeparator += 1;
      continue;
    }
    const firstCell = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0)[0];
    if (firstCell) {
      journeys.push(firstCell);
    }
  }
  return journeys;
}

function normalise(text: string): string {
  return text.toLowerCase().replaceAll(/\s+/g, ' ').trim();
}
