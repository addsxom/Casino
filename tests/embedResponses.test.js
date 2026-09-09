const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = [
  'Commands',
  'Events',
  'utils'
];

function collectJsFiles(dir) {
  const absolute = path.join(ROOT, dir);
  const entries = fs.readdirSync(
    absolute,
    { withFileTypes: true }
  );

  const files = [];

  for (const entry of entries) {
    const relative =
      path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(
        ...collectJsFiles(relative)
      );
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.endsWith('.js')
    ) {
      files.push(relative);
    }
  }

  return files;
}

test('discord responses do not use raw string payloads', () => {
  const files =
    SCAN_DIRS.flatMap(
      collectJsFiles
    );

  const violations = [];

  const rawCall =
    /\.(reply|send|followUp|editReply)\s*\(\s*(['"`])/g;

  for (const relative of files) {
    const source =
      fs.readFileSync(
        path.join(ROOT, relative),
        'utf8'
      );

    let match;

    while (
      (match = rawCall.exec(source))
    ) {
      const before =
        source.slice(
          0,
          match.index
        );

      const line =
        before.split('\n').length;

      violations.push(
        `${relative}:${line} .${match[1]}() utilise encore une chaîne brute`
      );
    }
  }

  assert.deepEqual(
    violations,
    [],
    'Toutes les réponses Discord doivent utiliser un embed ou une interface Component V2.\n' +
      violations.join('\n')
  );
});
