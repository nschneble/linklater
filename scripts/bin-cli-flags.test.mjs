/**
 * Pins each `bin/` command's three flag lists against each other.
 *
 * Every command states its flags three times: the `KNOWN_FLAGS` array the
 * unknown-option suggester reads, the `case` arms that act on them, and the
 * `Options:` block in the help heredoc. Nothing in bash keeps the three in
 * step, so this spec is what catches a flag added to one and not the others.
 *
 * `-h` and `--help` are the one asymmetry: `scan_help` intercepts them before
 * the argument loop runs, so they belong in `KNOWN_FLAGS` and the help text
 * but never get a `case` arm.
 *
 * Commands are discovered from `bin/`, so a new one is covered the day it
 * lands. Descriptions are read by column rather than scanned for `--`,
 * because `bin/flintest` quotes tuffgal's own flags inside one of its.
 */

import { deepStrictEqual, ok } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { join, resolve } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';

const binDirectory = resolve(import.meta.dirname, '..', 'bin');
const helpFlagsHandledByScanHelp = ['--help', '-h'];

// parse the Options block by column; a `--` scan grabs quoted flags too
const descriptionColumn = 15;

function readKnownFlags(source) {
  const declaration = source.match(/^KNOWN_FLAGS=\(([^)]*)\)/m);
  ok(declaration, 'expected a KNOWN_FLAGS declaration');
  return declaration[1].trim().split(/\s+/);
}

function readCaseArmFlags(source) {
  const start = source.indexOf('case "$argument" in');
  ok(start !== -1, 'expected a case statement over the arguments');
  const block = source.slice(start, source.indexOf('esac', start));

  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-') && line.endsWith(')'))
    .flatMap((line) => line.slice(0, -1).split('|'));
}

function readHelpFlags(source) {
  const lines = source.split('\n');
  const start = lines.indexOf('Options:');
  ok(start !== -1, 'expected an Options: block in the help text');

  const flags = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') {
      break;
    }
    const specification = line.slice(0, descriptionColumn).trim();
    if (specification !== '') {
      flags.push(...specification.split(/[\s,]+/));
    }
  }
  return flags;
}

function sortedUnique(flags) {
  return [...new Set(flags)].sort();
}

const commandNames = readdirSync(binDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();

ok(commandNames.length > 0, 'expected at least one command in bin/');

for (const commandName of commandNames) {
  describe(`bin/${commandName} flag lists`, () => {
    const source = readFileSync(join(binDirectory, commandName), 'utf8');
    const knownFlags = sortedUnique(readKnownFlags(source));
    const caseArmFlags = sortedUnique(readCaseArmFlags(source));
    const helpFlags = sortedUnique(readHelpFlags(source));

    it('names the same flags in KNOWN_FLAGS and in the help text', () => {
      ok(knownFlags.length > 0, 'parsed no flags out of KNOWN_FLAGS');
      ok(helpFlags.length > 0, 'parsed no flags out of the help text');
      deepStrictEqual(helpFlags, knownFlags);
    });

    it('gives every flag a case arm except the two scan_help intercepts', () => {
      ok(caseArmFlags.length > 0, 'parsed no flags out of the case arms');
      deepStrictEqual(
        caseArmFlags,
        knownFlags.filter((flag) => !helpFlagsHandledByScanHelp.includes(flag)),
      );
    });
  });
}
