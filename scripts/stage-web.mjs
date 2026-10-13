/**
 * Stage the shipped web app into dist/ for Capacitor.
 *
 * The app that ships on both platforms is the standalone build in APP/ -
 * plain HTML/CSS/JS, no bundler. `cap sync` copies whatever is in dist/
 * (webDir in capacitor.config.json) into android/ and ios/, so dist/ has to
 * hold APP/ and nothing else. Running `vite build` here instead would stage
 * the older src/ app and ship the wrong screens.
 *
 * Usage: node scripts/stage-web.mjs
 */
import { cpSync, existsSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'APP');
const dist = join(root, 'dist');

// Everything the app loads. reference/ (design photos) and the built .apk
// and .ipa stay out of the bundle.
//
// manifest/icons/sw.js only matter to the web build - the native apps ignore
// them - but they are copied anyway so dist/ is a complete, installable web
// app that can be served as-is.
const ENTRIES = [
  'index.html', 'css', 'js', 'assets',
  'manifest.webmanifest', 'icons', 'sw.js',
];

if (!existsSync(src)) {
  console.error(`No APP/ directory at ${src}`);
  process.exit(1);
}

const missing = ENTRIES.filter((e) => !existsSync(join(src, e)));
if (missing.length) {
  console.error(`APP/ is missing: ${missing.join(', ')}`);
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const entry of ENTRIES) {
  cpSync(join(src, entry), join(dist, entry), { recursive: true });
}

console.log(`staged APP/ -> dist/  (${readdirSync(dist).join(', ')})`);
