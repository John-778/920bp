/**
 * Checks on the real production output in dist/.
 *
 * These run only when dist/ exists. `npm run verify` builds first, so they
 * always run there; a bare `npm test` on a clean checkout skips them
 * rather than failing for the wrong reason.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const built = existsSync(join(dist, 'index.html'));

const read = (file) => readFileSync(join(dist, file), 'utf8');

describe.skipIf(!built)('built index.html', () => {
  const html = built ? read('index.html') : '';

  it('has a unique, descriptive title', () => {
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(10);
    expect(title).toContain('Digital Bus Pass');
  });

  it('has a meta description of a sensible length', () => {
    const description = /<meta\s+name="description"\s+content="([^"]+)"/.exec(html)?.[1];
    expect(description).toBeTruthy();
    expect(description.length).toBeGreaterThan(50);
    expect(description.length).toBeLessThan(200);
  });

  it('declares a viewport that covers the display cutout', () => {
    expect(html).toMatch(/name="viewport"[^>]*width=device-width/);
    expect(html).toMatch(/viewport-fit=cover/);
  });

  it('carries canonical, social and theme metadata', () => {
    expect(html).toMatch(/rel="canonical"/);
    expect(html).toMatch(/property="og:title"/);
    expect(html).toMatch(/property="og:description"/);
    expect(html).toMatch(/property="og:image"/);
    expect(html).toMatch(/name="theme-color"\s+content="#6200ea"/);
  });

  it('links the favicon, apple touch icon and manifest', () => {
    expect(html).toMatch(/rel="icon"[^>]*favicon\.svg/);
    expect(html).toMatch(/rel="apple-touch-icon"/);
    expect(html).toMatch(/rel="manifest"/);
  });

  it('tells users what to do when JavaScript is off', () => {
    expect(html).toMatch(/<noscript>/);
    expect(html).toMatch(/JavaScript is required/i);
  });

  it('uses relative asset paths so it works from a sub-path and a WebView', () => {
    const srcs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    const rooted = srcs.filter((s) => s.startsWith('/'));
    expect(rooted).toEqual([]);
  });
});

describe.skipIf(!built)('static 404 page', () => {
  it('is emitted and is not indexable', () => {
    expect(existsSync(join(dist, '404.html'))).toBe(true);
    const html = read('404.html');
    expect(html).toMatch(/noindex/);
    expect(html).toMatch(/404/);
    expect(html).toMatch(/href="\/"/); // a way back home
  });
});

describe.skipIf(!built)('web app manifest', () => {
  it('declares what a PWA install needs', () => {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#6200ea');
    expect(manifest.start_url).toContain('#/');

    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  it('ships every icon the manifest points at', () => {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    for (const icon of manifest.icons) {
      expect(existsSync(join(dist, icon.src)), `missing ${icon.src}`).toBe(true);
    }
  });
});

describe.skipIf(!built)('production bundle', () => {
  const jsFiles = built
    ? readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'))
    : [];

  it('emits JavaScript', () => {
    expect(jsFiles.length).toBeGreaterThan(0);
  });

  it('contains no debugger statements or development logging', () => {
    for (const file of jsFiles) {
      const code = readFileSync(join(dist, 'assets', file), 'utf8');
      expect(code, `${file} has a debugger statement`).not.toMatch(/\bdebugger\b/);
      expect(code, `${file} has console.log`).not.toMatch(/console\.log\(/);
    }
  });

  it('ships no source maps in a production build', () => {
    const maps = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.map'));
    expect(maps).toEqual([]);
  });

  it('stays small enough to open quickly on a phone', () => {
    const total = jsFiles.reduce(
      (sum, file) => sum + statSync(join(dist, 'assets', file)).size,
      0
    );
    expect(total).toBeLessThan(250 * 1024);
  });
});

describe.skipIf(!built)('shipped images', () => {
  it('keeps the QR code and logo small', () => {
    const qr = statSync(join(dist, 'assets', 'qr-default.png')).size;
    const logo = statSync(join(dist, 'assets', 'tcs-logo.png')).size;
    // Originals were 138 KB and 193 KB.
    expect(qr).toBeLessThan(100 * 1024);
    expect(logo).toBeLessThan(40 * 1024);
  });
});
