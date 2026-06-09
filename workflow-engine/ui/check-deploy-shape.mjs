// Deploy-shape gate for the buildless static UI.
//
// The UI ships as raw static files (React.createElement, no JSX, no bundler) —
// Vercel just serves them, so nothing transpiles or syntax-checks the JS on the
// way to production. A syntax error in js/*.js would deploy "successfully" and
// white-screen the app at runtime. This is the ONLY guard against that, so it
// runs as the validate `build` gate. Run from workflow-engine/ui/.
//
// Exits non-zero (so the validate runner records a failed gate) if any JS file
// fails `node --check`, a required deploy file is missing, vercel.json /
// manifest.json don't parse, or index.html isn't wired to the module entry.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_FILES = [
  'index.html', 'styles.css', 'js/main.js', 'js/api.js',
  'manifest.json', 'sw.js', 'vercel.json',
];

function collectJsFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collectJsFiles(file));
    else if (entry.isFile() && file.endsWith('.js')) found.push(file);
  }
  return found;
}

function fail(message) {
  console.error(`deploy-shape: ${message}`);
  process.exit(1);
}

// 1. Syntax-check every shipped JS file (js/**/*.js plus the top-level worker).
const jsFiles = [...collectJsFiles('js').sort(), 'sw.js'];
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// 2. Required deploy files must exist.
for (const file of REQUIRED_FILES) {
  if (!fs.existsSync(file)) fail(`missing ${file}`);
}

// 3. Config files must be valid JSON.
JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

// 4. index.html must wire up the module entry point.
const html = fs.readFileSync('index.html', 'utf8');
if (!html.includes('type="module" src="./js/main.js"')) {
  fail('index.html missing module entry (type="module" src="./js/main.js")');
}

console.log(`deploy-shape: ok (${jsFiles.length} js files checked, ${REQUIRED_FILES.length} required files present)`);
