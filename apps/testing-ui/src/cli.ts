#!/usr/bin/env node
import { approveAll } from './runner/approve.ts';
import { runAll } from './runner/run.ts';

interface ParsedArguments {
  command: 'run' | 'approve' | 'help';
  storyFilter?: string;
  headed: boolean;
}

function parseArguments(argv: string[]): ParsedArguments {
  const [command, ...rest] = argv;
  const parsed: ParsedArguments = {
    command:
      command === 'run' || command === 'approve' || command === 'help'
        ? command
        : 'help',
    headed: false,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--headed') {
      parsed.headed = true;
    } else if (arg === '--story') {
      parsed.storyFilter = rest[index + 1];
      index += 1;
    } else if (arg.startsWith('--story=')) {
      parsed.storyFilter = arg.slice('--story='.length);
    }
  }
  return parsed;
}

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: testing-ui <command> [options]',
      '',
      'Commands:',
      '  run                 Run every story under stories/.',
      '  approve             Promote every "changed" actual to its baseline.',
      '  help                Show this message.',
      '',
      'Options:',
      '  --story <name>      Filter to a single story (filename or story text).',
      '  --headed            Show the browser while running.',
    ].join('\n') + '\n',
  );
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  if (args.command === 'help') {
    printHelp();
    return;
  }
  if (args.command === 'run') {
    const result = await runAll({
      storyFilter: args.storyFilter,
      headed: args.headed,
    });
    process.stdout.write(
      `\nTotals: ${result.totals.passed} pass · ${result.totals.changed} changed · ${result.totals.failed} failed\n`,
    );
    process.exit(result.totals.failed > 0 ? 1 : 0);
  }
  if (args.command === 'approve') {
    const summary = await approveAll({
      storyFilter: args.storyFilter,
    });
    process.stdout.write(
      `\nApproved ${summary.approved} baselines; skipped ${summary.skipped} actions.\n`,
    );
  }
}

main().catch((error) => {
  process.stderr.write(
    `testing-ui error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
