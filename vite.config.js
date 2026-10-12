import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig(({ mode }) => ({
  /**
   * Relative base so one build runs unchanged from a web host (including a
   * sub-path such as GitHub Pages) and from the Capacitor WebView origin on
   * Android and iOS.
   */
  base: './',

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: ['es2020', 'chrome90', 'safari14'], // Capacitor's minimum WebViews
    sourcemap: mode !== 'production',
    cssCodeSplit: false,
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@capacitor')) return 'capacitor';
          return undefined;
        },
      },
    },
  },

  server: {
    port: 5173,
    host: true, // reachable from a phone on the same network for device testing
  },

  preview: {
    port: 4173,
    host: true,
  },

  esbuild: {
    // Strip console.log / debugger from production, keep warn and error.
    drop: mode === 'production' ? ['debugger'] : [],
    pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
  },

  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.test.js'],
    restoreMocks: true,
  },
}));
