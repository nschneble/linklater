import type { Reporter, TestModule } from 'vitest/node';

import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';

export default class FailedFilesReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    // npm sets INIT_CWD to the directory the user invoked npm from. When the
    // user runs `npm run test` (or `--workspace @linklater/web`) at the repo
    // root, this resolves paths root-relative so they can be opened directly
    // or re-run with `npm run test <path>`. Falls back to cwd if npm isn't
    // the launcher.
    const baseDirectory = process.env['INIT_CWD'] ?? process.cwd();
    const failedFiles = testModules
      .filter((testModule) => testModule.state() === 'failed')
      .map((testModule) => relative(baseDirectory, testModule.moduleId));

    const outputPath = process.env['LINKLATER_FAILED_TESTS_OUTPUT'];
    if (outputPath) {
      writeFileSync(outputPath, JSON.stringify({ failed: failedFiles }));
      return;
    }

    if (failedFiles.length === 0) {
      return;
    }

    console.error(`\nFailed test files (${failedFiles.length}):`);
    for (const filePath of failedFiles) {
      console.error(`  ${filePath}`);
    }
    console.error('');
  }
}
