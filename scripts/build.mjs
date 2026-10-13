// Builds the site's CSS and JavaScript from src/ into docs/, which
// GitHub Pages serves as-is: the readable, commented sources live in
// src/, and docs/ gets minified copies under the same names. Each page
// links them with ?v=<content hash>, so a browser (or the service
// worker) can keep a copy for as long as it likes - a change to either
// file changes its URL.
//
//   npm run build          rebuild docs/ from src/
//   npm run build -- --check  exit 1 if docs/ is out of date (CI)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { transform } from 'esbuild';

const root = new URL('..', import.meta.url).pathname;
const docs = join(root, 'docs');
const check = process.argv.includes('--check');

const assets = [
  { src: 'src/styles.css', out: 'styles.css', loader: 'css' },
  { src: 'src/script.js', out: 'script.js', loader: 'js' },
];

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 10);
const outputs = new Map(); // docs path -> expected contents
const versions = {};

for (const { src, out, loader } of assets) {
  const source = readFileSync(join(root, src), 'utf8');
  const { code } = await transform(source, {
    loader,
    minify: true,
    // No target: the sources already use only what current browsers
    // support, so nothing is rewritten, only shortened.
    banner: `/*! Built from ${src} by npm run build - edit that file, not this one. */`,
  });
  outputs.set(join(docs, out), code);
  versions[out] = hash(code);
}

// href="styles.css", href="/styles.css?v=...", src="script.js" ... in
// every page; prose mentioning the file names is left alone.
for (const file of htmlFiles(docs)) {
  const html = readFileSync(file, 'utf8');
  const updated = html.replace(/((?:href|src)="\/?)(styles\.css|script\.js)(?:\?v=[0-9a-f]+)?"/g,
    (_, start, name) => `${start}${name}?v=${versions[name]}"`);
  outputs.set(file, updated);
}

// The service worker caches by URL; its cache name carries the versions
// so a new build replaces the old cache (see docs/sw.js).
const swPath = join(docs, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
outputs.set(swPath, sw
  .replace(/const VERSION = '[^']*';/, `const VERSION = '${hash(Object.values(versions).join())}';`)
  .replace(/const STYLES = '[^']*';/, `const STYLES = '/styles.css?v=${versions['styles.css']}';`)
  .replace(/const SCRIPT = '[^']*';/, `const SCRIPT = '/script.js?v=${versions['script.js']}';`));

const stale = [];
for (const [file, expected] of outputs) {
  let current = null;
  try { current = readFileSync(file, 'utf8'); } catch {}
  if (current === expected) continue;
  stale.push(relative(root, file));
  if (!check) writeFileSync(file, expected);
}

if (check && stale.length) {
  console.error(`docs/ is out of date with src/ - run npm run build. Stale:\n  ${stale.join('\n  ')}`);
  process.exit(1);
}
console.log(stale.length ? `${check ? 'Stale' : 'Wrote'}: ${stale.join(', ')}` : 'docs/ is up to date.');
