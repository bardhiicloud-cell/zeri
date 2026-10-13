import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
import reactHooks from 'eslint-plugin-react-hooks';

const readonly = (names) => Object.fromEntries(names.map((name) => [name, 'readonly']));

// Standard names the plain-JavaScript tooling uses. (The `globals` package is not a dependency.)
const NODE_GLOBALS = readonly([
  'console', 'process', 'require', 'module', 'exports', '__dirname', '__filename', 'Buffer',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'queueMicrotask',
  'fetch', 'URL', 'URLSearchParams', 'AbortController', 'TextEncoder', 'TextDecoder', 'structuredClone',
  'Response', 'Request', 'Headers', 'FormData', 'Blob', 'performance',
]);
// QA scripts hand code to a browser page (page.evaluate), so those names are legitimate there.
const BROWSER_GLOBALS = readonly([
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location', 'history',
  'getComputedStyle', 'requestAnimationFrame', 'MutationObserver', 'IntersectionObserver', 'HTMLElement',
]);

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  firebaseRulesPlugin.configs['flat/recommended'],
  {
    // A leading underscore is the deliberate way to say "this is unused on purpose"
    // (an omitted key in a destructuring, a callback argument that must be declared).
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true
      }]
    }
  },
  {
    // One-off tooling: Node scripts at the repository root, in scripts/, qa/ and tools/.
    files: ['*.{js,cjs,mjs}', 'scripts/**/*.{js,cjs,mjs}', 'qa/**/*.{js,cjs,mjs}', 'tools/**/*.{js,cjs,mjs}', 'src/**/*.{js,cjs}'],
    languageOptions: { globals: { ...NODE_GLOBALS, ...BROWSER_GLOBALS } },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  },
  {
    files: ['*.{ts,cjs}', 'scripts/**/*.{ts,cjs}', 'qa/**/*.{ts,cjs}', 'tools/**/*.{ts,cjs}'],
    languageOptions: { globals: NODE_GLOBALS }
  },
  {
    // React Hooks: the two classic rules, enforced. (The plugin's newer "compiler" rules are not enabled.)
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error'
    }
  },
  {
    // Test doubles (fake Firestore, partial Express requests, mocked modules) are
    // legitimately loosely typed. Production code keeps the rule.
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
];
