import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {execSync} from 'node:child_process';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {build as esbuild} from 'esbuild';

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


/**
 * Splits the generated translation tables into one lazy module per language.
 *
 * The tables are keyed by the Albanian source text and hold every language side
 * by side (~3.9 MB), so a visitor reading French used to download all of them.
 * `virtual:zeri-translations/<lang>` holds only that language, already merged in
 * the lookup order dt() documents (public pages, added languages, site gap-fills,
 * UI labels, then the original six, falling back to the Albanian entry), and
 * `virtual:zeri-translations/loaders` maps each language to its dynamic import.
 */
function translationChunks(): Plugin {
  const PREFIX = 'virtual:zeri-translations/';
  type Table = Record<string, Record<string, string>>;
  let merged: Promise<Record<string, Record<string, string>>> | null = null;

  const build = async () => {
    const result = await esbuild({
      entryPoints: [path.resolve(__dirname, 'src/lib/translationTables.ts')],
      bundle: true,
      format: 'esm',
      write: false,
      logLevel: 'silent',
    });
    const url = 'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64');
    const t = (await import(/* @vite-ignore */ url)) as Record<string, Table>;
    const order = [t.publicPagesTranslations, t.newLanguageTranslations, t.siteTranslations, t.uiTranslations, t.dynamicTranslations];
    const perLang: Record<string, Record<string, string>> = {};
    const texts = new Set<string>();
    for (const table of order) for (const text of Object.keys(table)) texts.add(text);
    for (const text of texts) {
      const langs = new Set<string>();
      for (const table of order) for (const lang of Object.keys(table[text] ?? {})) langs.add(lang);
      for (const lang of langs) {
        let value: string | undefined;
        for (const table of order) {
          value = table[text]?.[lang];
          if (value) break;
        }
        // Same fallback dt() applies: the original six fall back to the Albanian entry.
        if (!value) value = t.dynamicTranslations[text]?.sq;
        if (value && value !== text) (perLang[lang] ??= {})[text] = value;
      }
    }
    return perLang;
  };

  return {
    name: 'zeri-translation-chunks',
    resolveId(id) {
      if (id.startsWith(PREFIX)) return '\0' + id;
    },
    async load(id) {
      if (!id.startsWith('\0' + PREFIX)) return;
      merged ??= build();
      const perLang = await merged;
      const name = id.slice(('\0' + PREFIX).length);
      if (name === 'loaders') {
        const entries = Object.keys(perLang).map((lang) => `  ${JSON.stringify(lang)}: () => import(${JSON.stringify(PREFIX + lang)}),`);
        return `export const translationLoaders = {\n${entries.join('\n')}\n};\n`;
      }
      return `export default ${JSON.stringify(perLang[name] ?? {})};\n`;
    },
    handleHotUpdate({file, server}) {
      if (/\/src\/lib\/\w*Translations\.ts$/.test(file)) {
        merged = null;
        for (const mod of server.moduleGraph.idToModuleMap.values()) {
          if (mod.id?.includes(PREFIX)) server.moduleGraph.invalidateModule(mod);
        }
      }
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), buildVersion(), translationChunks()],
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
