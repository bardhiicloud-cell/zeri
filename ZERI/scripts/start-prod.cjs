/**
 * Production entry point.
 *
 * `node dist/server.cjs` on its own runs whatever NODE_ENV the platform happens
 * to provide, and Cloud Run provides none. server.ts treats "not production" as
 * development: it mounts the Vite dev middleware and the CORS policy accepts any
 * origin. Defaulting here makes `npm start` safe on every host; set NODE_ENV
 * explicitly to override (for example to `staging`).
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('../dist/server.cjs');
