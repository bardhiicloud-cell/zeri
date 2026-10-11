import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
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
            'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'ui': ['lucide-react', 'framer-motion', 'recharts', 'leaflet', 'react-leaflet']
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
