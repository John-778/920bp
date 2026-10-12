/**
 * Asset pipeline.
 *
 * Takes the original artwork in assets-src/ and produces the compressed
 * copies the app ships, plus the icon set for the browser, the PWA, and
 * the Android / iOS packages.
 *
 * Run with `npm run images` (the build runs it automatically).
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'assets-src');
const publicDir = join(root, 'public');
const assetsOut = join(publicDir, 'assets');
const iconsOut = join(publicDir, 'icons');
const resourcesOut = join(root, 'resources');

const BRAND = '#6200ea';
const INK = '#ffffff';

/** The app mark: a bus on the brand purple. */
function iconSVG(size, { maskable = false } = {}) {
  // A maskable icon must keep its artwork inside the middle 80%.
  const scale = maskable ? 0.62 : 0.76;
  const glyph = size * scale;
  const offset = (size - glyph) / 2;
  const radius = maskable ? 0 : size * 0.22;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND}"/>
  <g transform="translate(${offset} ${offset}) scale(${glyph / 100})">
    <path fill="${INK}" d="M18 8h64a10 10 0 0 1 10 10v40a10 10 0 0 1-10 10H18A10 10 0 0 1 8 58V18A10 10 0 0 1 18 8Z"/>
    <rect x="16" y="18" width="30" height="20" rx="4" fill="${BRAND}"/>
    <rect x="54" y="18" width="30" height="20" rx="4" fill="${BRAND}"/>
    <rect x="16" y="46" width="12" height="8" rx="3" fill="${BRAND}"/>
    <rect x="72" y="46" width="12" height="8" rx="3" fill="${BRAND}"/>
    <circle cx="28" cy="76" r="10" fill="${INK}"/>
    <circle cx="28" cy="76" r="4.5" fill="${BRAND}"/>
    <circle cx="72" cy="76" r="10" fill="${INK}"/>
    <circle cx="72" cy="76" r="4.5" fill="${BRAND}"/>
    <rect x="34" y="70" width="32" height="6" rx="3" fill="${INK}"/>
  </g>
</svg>`;
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${BRAND}"/>
  <path fill="${INK}" d="M26 18h48a9 9 0 0 1 9 9v30a9 9 0 0 1-9 9H26a9 9 0 0 1-9-9V27a9 9 0 0 1 9-9Z"/>
  <rect x="24" y="26" width="23" height="16" rx="3" fill="${BRAND}"/>
  <rect x="53" y="26" width="23" height="16" rx="3" fill="${BRAND}"/>
  <circle cx="33" cy="76" r="8" fill="${INK}"/><circle cx="33" cy="76" r="3.5" fill="${BRAND}"/>
  <circle cx="67" cy="76" r="8" fill="${INK}"/><circle cx="67" cy="76" r="3.5" fill="${BRAND}"/>
  <rect x="38" y="71" width="24" height="5" rx="2.5" fill="${INK}"/>
</svg>`;

async function ensureDirs() {
  for (const dir of [assetsOut, iconsOut, resourcesOut]) {
    await mkdir(dir, { recursive: true });
  }
}

async function report(label, path) {
  const { size } = await stat(path);
  console.log(`  ${label.padEnd(30)} ${(size / 1024).toFixed(1).padStart(7)} KB`);
}

async function buildAppAssets() {
  console.log('\nApp assets');

  // QR: the scannable code. This one is deliberately NOT quantised or
  // resampled. Flattening the alpha onto white and re-encoding greyscale
  // is bit-exact against the original (verified: zero differing pixels)
  // and still saves ~45%. Palettising to 2 colours saved more but flipped
  // ~3% of the edge pixels, which is not a risk worth taking on a code
  // that has to be read by a scanner.
  const qrSrc = join(src, 'QR.png');
  if (existsSync(qrSrc)) {
    const out = join(assetsOut, 'qr-default.png');
    await sharp(qrSrc)
      .flatten({ background: '#ffffff' })
      .greyscale()
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(out);
    await report('qr-default.png (lossless)', out);
  } else {
    console.warn('  ! assets-src/QR.png missing, skipped');
  }

  // TCS wordmark: white on transparent, shown at ~130 CSS px. The original
  // is 7429px wide, which is ~50x more pixels than any screen can use.
  const logoSrc = join(src, 'tcsw.png');
  if (existsSync(logoSrc)) {
    const out = join(assetsOut, 'tcs-logo.png');
    await sharp(logoSrc)
      .trim()
      .resize(600, null, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(out);
    await report('tcs-logo.png', out);
  } else {
    console.warn('  ! assets-src/tcsw.png missing, skipped');
  }
}

async function buildIcons() {
  console.log('\nIcons');

  await writeFile(join(publicDir, 'favicon.svg'), FAVICON_SVG, 'utf8');
  await report('favicon.svg', join(publicDir, 'favicon.svg'));

  const sizes = [
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['icon-maskable-512.png', 512, true],
    ['apple-touch-icon.png', 180, false],
  ];

  for (const [name, size, maskable] of sizes) {
    const out = join(iconsOut, name);
    await sharp(Buffer.from(iconSVG(size, { maskable })))
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(out);
    await report(name, out);
  }

  // favicon.ico for browsers and crawlers that still ask for it
  const ico = join(publicDir, 'favicon.ico');
  await sharp(Buffer.from(iconSVG(48))).resize(48, 48).png().toFile(ico);
  await report('favicon.ico (png data)', ico);

  // Social preview card
  const og = join(iconsOut, 'og-image.png');
  const ogSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#000000"/>
    <rect x="0" y="0" width="1200" height="8" fill="${BRAND}"/>
    <text x="80" y="300" font-family="Arial, sans-serif" font-size="68" font-weight="bold" fill="#ffffff">Digital Bus Pass</text>
    <text x="80" y="370" font-family="Arial, sans-serif" font-size="32" fill="#9b9b9b">Your pass details, on your own phone, offline.</text>
  </svg>`;
  await sharp(Buffer.from(ogSVG))
    .composite([{ input: Buffer.from(iconSVG(200)), top: 80, left: 80 }])
    .png({ compressionLevel: 9 })
    .toFile(og);
  await report('og-image.png', og);
}

/**
 * Source artwork for @capacitor/assets, which turns these two files into
 * every Android mipmap and iOS AppIcon slot.
 */
async function buildNativeSources() {
  console.log('\nNative source artwork (resources/)');

  const icon = join(resourcesOut, 'icon.png');
  await sharp(Buffer.from(iconSVG(1024))).png({ compressionLevel: 9 }).toFile(icon);
  await report('icon.png (1024)', icon);

  // Splash: the mark centred on the app's black background.
  for (const [name, bg, fg] of [
    ['splash.png', '#000000', INK],
    ['splash-dark.png', '#000000', INK],
  ]) {
    const out = join(resourcesOut, name);
    const canvas = sharp({
      create: { width: 2732, height: 2732, channels: 4, background: bg },
    });
    const mark = await sharp(Buffer.from(iconSVG(620))).png().toBuffer();
    await canvas
      .composite([{ input: mark, gravity: 'centre' }])
      .png({ compressionLevel: 9 })
      .toFile(out);
    await report(name, out);
    void fg;
  }
}

/**
 * Note: `npx capacitor-assets generate` (used once when the native projects
 * were created) rewrites public/manifest.webmanifest to point at a webp
 * icon set of its own. This project keeps its hand-written manifest and the
 * PNG icons produced above; if you re-run capacitor-assets, restore the
 * manifest afterwards. tests/build.test.js fails if the manifest ever
 * references an icon that is not shipped.
 */
async function main() {
  console.log('Optimising assets...');
  await ensureDirs();
  await buildAppAssets();
  await buildIcons();
  await buildNativeSources();
  console.log('\nDone.\n');
}

main().catch((error) => {
  console.error('\nAsset pipeline failed:', error.message);
  process.exit(1);
});
