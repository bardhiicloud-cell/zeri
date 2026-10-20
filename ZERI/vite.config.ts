import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {execSync} from 'node:child_process';
import {defineConfig, loadEnv, type Plugin} from 'vite';

/**
 * Writes /version.json into the build: the commit and time it was built from.
 * Opening https://<site>/version.json answers "which version is live?" without
 * guessing from behaviour. Never contains configuration or secrets.
 */
function buildVersion(): Plugin {
  const git = (cmd: string) => {
    try {
      return execSync(cmd, {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
    } catch {
      return 'unknown';
    }
  };
  return {
    name: 'zeri-build-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          commit: git('git rev-parse --short HEAD'),
          commitDate: git('git log -1 --format=%cI'),
          builtAt: new Date().toISOString(),
        }, null, 2),
      });
    },
  };
}


export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), buildVersion()],
    resolve: {
      // The tree carries stale compiled `.js` twins beside most `.tsx`/`.ts`
      // sources. Vite's default extension order resolves `.js` BEFORE `.tsx`,
      // so an extension-less import silently loaded the outdated compiled twin
      // and every TypeScript edit was invisible at runtime. Preferring the TS
      // extensions makes the typed sources the single source of truth again
      // without deleting anything.
      extensions: ['.mjs', '.ts', '.tsx', '.mts', '.jsx', '.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom', 'react-router-dom', 'zustand'],
            'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            // Charts and maps are deliberately NOT listed: only a few lazy pages
            // use them, and naming them here made every first visit download
            // ~500 kB of Leaflet and Recharts before the home page could paint.
            'ui': ['lucide-react', 'framer-motion']
          }
        }
      },
      chunkSizeWarningLimit: 1000
    },
    server: {
      host: '0.0.0.0',
      port: 3002,
      strictPort: false,
    },
    preview: {
      host: '0.0.0.0',
      port: 3002,
      strictPort: true,
    },
  };
});
