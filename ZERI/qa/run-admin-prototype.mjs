import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

const isWindows = process.platform === 'win32';
const projectId = 'demo-zeri-admin-prototype';
const emulatorPorts = [9099, 8080, 9199];
const env = { ...process.env };
const children = new Set();
let stopping = false;

function hasServiceCredentials() {
  return Boolean(env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

if (hasServiceCredentials()) {
  console.error('Nuk niset prototipi: hiqni FIREBASE_SERVICE_ACCOUNT dhe FIREBASE_SERVICE_ACCOUNT_PATH nga ky terminal.');
  process.exit(1);
}

function resolveJavaHome() {
  const candidates = [env.PROTOTYPE_JAVA_HOME, env.JAVA_HOME].filter(Boolean);
  const bundledRoot = path.join(env.USERPROFILE || '', '.kombai', 'tools', 'temurin-21');
  if (existsSync(bundledRoot)) {
    for (const entry of readdirSync(bundledRoot)) candidates.push(path.join(bundledRoot, entry));
  }
  return candidates.find((candidate) => existsSync(path.join(candidate, 'bin', isWindows ? 'java.exe' : 'java'))) || '';
}

const javaHome = resolveJavaHome();
if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${path.join(javaHome, 'bin')}${path.delimiter}${env.PATH || ''}`;
}

for (const port of emulatorPorts) {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', () => reject(new Error(`Porti ${port} është në përdorim; mbyllni procesin që e përdor para testimit.`)));
    probe.once('listening', () => probe.close(resolve));
    probe.listen(port, '127.0.0.1');
  });
}

Object.assign(env, {
  NODE_ENV: 'development',
  PORT: env.PROTOTYPE_ADMIN_PORT || '3010',
  CLUSTER_ENABLED: 'false',
  VITE_PROTOTYPE_ADMIN: 'true',
  VITE_PROTOTYPE_FIREBASE_EMULATORS: 'true',
  VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_API_KEY: 'demo-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: `${projectId}.firebaseapp.com`,
  VITE_FIREBASE_STORAGE_BUCKET: `${projectId}.firebasestorage.app`,
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:prototype-local-only',
  VITE_FIREBASE_DATABASE_ID: '',
  FIREBASE_PROJECT_ID: projectId,
  GCLOUD_PROJECT: projectId,
  FIREBASE_DATABASE_ID: '',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
});

function spawnChild(command, args, label, shell = false) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
    shell,
  });
  children.add(child);
  child.on('exit', () => children.delete(child));
  child.on('error', (error) => console.error(`${label}:`, error.message));
  return child;
}

function waitForPort(port, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error(`Emulatori në portin ${port} nuk u nis brenda afatit.`));
        else setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}

async function stopAll() {
  if (stopping) return;
  stopping = true;
  const current = [...children];
  if (isWindows) {
    await Promise.all(current.filter((child) => child.pid).map((child) => new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    })));
  } else {
    current.forEach((child) => child.kill('SIGTERM'));
  }
}

process.once('SIGINT', () => { void stopAll(); });
process.once('SIGTERM', () => { void stopAll(); });

try {
  console.log(`Sandbox lokal: ${projectId}. Nuk do të përdoret projekt apo dokument prodhimi.`);
  if (!env.JAVA_HOME || !path.isAbsolute(env.JAVA_HOME)) {
    throw new Error('Java 21 mungon. Instalojeni Java 21 ose caktoni JAVA_HOME / PROTOTYPE_JAVA_HOME.');
  }
  const javaVersion = await new Promise((resolve, reject) => {
    const probe = spawn(process.platform === 'win32' ? 'java.exe' : 'java', ['-version'], { env, stdio: 'ignore' });
    probe.once('error', reject);
    probe.once('exit', (code) => code === 0 ? resolve(true) : reject(new Error('Java nuk u nis.')));
  }).catch(() => false);
  if (!javaVersion) throw new Error(`Nuk u gjet Java në ${env.JAVA_HOME}. Vendosni PROTOTYPE_JAVA_HOME te një Java 21+.`);

  const firebaseCli = path.join(process.cwd(), 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
  const emulator = spawnChild(process.execPath, [
    firebaseCli, 'emulators:start', '--config', 'firebase.prototype.json', '--project', projectId,
    '--only', 'auth,firestore,storage', '--non-interactive',
  ], 'Firebase Emulator');

  await Promise.all(emulatorPorts.map((port) => waitForPort(port)));
  console.log('Emulatorët janë gati; po mbillen llogaria dhe të dhënat testuese…');

  const tsx = path.join('node_modules', 'tsx', 'dist', 'cli.mjs');
  await new Promise((resolve, reject) => {
    const seeder = spawnChild(process.execPath, [tsx, 'qa/seed-prototype-emulator.ts'], 'Seed');
    seeder.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Seed-i dështoi (${code}).`)));
    seeder.once('error', reject);
  });

  console.log(`Hapni http://127.0.0.1:${env.PORT}/login dhe kyçuni si admin@kosova.com / admin123.`);
  const server = spawnChild(process.execPath, [tsx, 'server.ts'], 'Server');
  await new Promise((resolve, reject) => {
    server.once('exit', (code) => code === 0 || stopping ? resolve() : reject(new Error(`Serveri doli me kodin ${code}.`)));
    server.once('error', reject);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await stopAll();
}
