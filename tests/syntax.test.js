const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const DIRECTORIES = [
  'Commands',
  'Events',
  'Loaders',
  'Models',
  'utils',
  'config',
  'tests'
];

const ROOT_FILES = [
  'main.js',
  'anti-crash.js',
  'utils.js'
];

function collectJavaScriptFiles(relativeDir) {
  const absoluteDir = path.join(ROOT, relativeDir);
  const result = [];

  if (!fs.existsSync(absoluteDir)) {
    return result;
  }

  for (const entry of fs.readdirSync(absoluteDir, {
    withFileTypes: true
  })) {
    const relativePath = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      result.push(...collectJavaScriptFiles(relativePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      result.push(relativePath);
    }
  }

  return result;
}

const projectFiles = [
  ...DIRECTORIES.flatMap(collectJavaScriptFiles),
  ...ROOT_FILES
].sort();

test('project JavaScript files compile', async t => {
  assert.ok(projectFiles.length > 0);

  for (const relativePath of projectFiles) {
    await t.test(relativePath, () => {
      const source = fs.readFileSync(
        path.join(ROOT, relativePath),
        'utf8'
      );

      assert.doesNotThrow(
        () => new Function(source),
        `Invalid JavaScript syntax in ${relativePath}`
      );
    });
  }
});
