'use strict';

const { writeFileSync } = require('node:fs');
const { relative } = require('node:path');

class FailedFilesReporter {
  onRunComplete(_testContexts, aggregatedResult) {
    // npm INIT_CWD = invocation dir; make paths root-relative, else cwd
    const baseDirectory = process.env.INIT_CWD || process.cwd();
    const failedFiles = aggregatedResult.testResults
      .filter(
        (testResult) =>
          testResult.numFailingTests > 0 || testResult.testExecError,
      )
      .map((testResult) => relative(baseDirectory, testResult.testFilePath));

    const outputPath = process.env.LINKLATER_FAILED_TESTS_OUTPUT;
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

module.exports = FailedFilesReporter;
