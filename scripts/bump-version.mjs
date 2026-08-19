import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const newVersion = process.argv[2];

if (!newVersion) {
  fail('Usage: npm run version:bump -- <version>');
}

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(newVersion)) {
  fail(`Invalid version "${newVersion}". Expected a version like 0.3.0.`);
}

const packagePaths = ['package.json', ...workspacePackagePaths()];
const previousVersion = readJson('package.json').version;

for (const packagePath of packagePaths) {
  updateJsonFile(packagePath, (json) => {
    json.version = newVersion;
    return json;
  });
}

updatePackageLock(packagePaths);
writeFile('VERSION', `${newVersion}\n`);
updateChangelog(previousVersion, newVersion);

console.log(`Bumped Linklater from ${previousVersion} to ${newVersion}.`);

function workspacePackagePaths() {
  const rootPackage = readJson('package.json');
  const workspaces = Array.isArray(rootPackage.workspaces)
    ? rootPackage.workspaces
    : (rootPackage.workspaces?.packages ?? []);

  return workspaces.flatMap((workspace) => {
    if (!workspace.endsWith('/*')) {
      return [`${workspace}/package.json`].filter(fileExists);
    }

    const workspaceRoot = workspace.slice(0, -2);
    const absoluteWorkspaceRoot = path.join(root, workspaceRoot);

    if (!fs.existsSync(absoluteWorkspaceRoot)) {
      return [];
    }

    return fs
      .readdirSync(absoluteWorkspaceRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(workspaceRoot, entry.name, 'package.json'))
      .filter(fileExists);
  });
}

function updatePackageLock(packagePathsToUpdate) {
  if (!fileExists('package-lock.json')) {
    return;
  }

  updateJsonFile('package-lock.json', (lockfile) => {
    lockfile.version = newVersion;

    for (const packagePath of packagePathsToUpdate) {
      const packageJson = readJson(packagePath);
      const packageKey =
        packagePath === 'package.json' ? '' : path.dirname(packagePath);

      if (lockfile.packages?.[packageKey]) {
        lockfile.packages[packageKey].version = packageJson.version;
      }
    }

    return lockfile;
  });
}

function updateChangelog(previous, next) {
  const changelogPath = 'CHANGELOG.md';

  if (!fileExists(changelogPath)) {
    return;
  }

  let changelog = readFile(changelogPath);

  if (!changelog.includes(`## [${next}]`)) {
    const today = formatDate(new Date());
    const section = `## [${next}] - ${today}

### Added

- _TODO_

### Changed

- _TODO_

### Fixed

- _TODO_
`;

    const unreleasedIndex = changelog.indexOf('## [Unreleased]');
    const nextSectionIndex = changelog.indexOf('\n## [', unreleasedIndex + 1);
    const insertAt =
      nextSectionIndex === -1 ? changelog.length : nextSectionIndex + 1;

    changelog = `${changelog.slice(0, insertAt)}${section}\n${changelog.slice(insertAt)}`;
  }

  const unreleasedRef = new RegExp(
    String.raw`^(\[Unreleased\]: https:\/\/github\.com\/[^\s]+\/compare\/v)([^\s]+)(\.\.\.HEAD)$`,
    'm',
  );

  changelog = changelog.replace(unreleasedRef, `$1${next}$3`);

  if (!changelog.includes(`[${next}]: `)) {
    changelog = changelog.replace(
      /^(\[Unreleased\]: .+)$/m,
      `$1\n[${next}]: https://github.com/nschneble/linklater/compare/v${previous}...v${next}`,
    );
  }

  writeFile(changelogPath, changelog);
}

function readJson(relativePath) {
  return JSON.parse(readFile(relativePath));
}

function updateJsonFile(relativePath, update) {
  const json = update(readJson(relativePath));
  writeFile(relativePath, `${JSON.stringify(json, null, 2)}\n`);
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function writeFile(relativePath, contents) {
  fs.writeFileSync(path.join(root, relativePath), contents);
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
