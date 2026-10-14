import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { arrayUnion, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

/**
 * Support conversations: the citizen owns theirs; an agent sees the waiting queue and only
 * the conversations they accepted; nobody but the server changes who holds one.
 * Run with: npm run test:rules
 */
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-zeri-rules',
    firestore: { rules: readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'cit'), { name: 'Qytetari', role: 'citizen' });
    await setDoc(doc(db, 'supportChats', 'waiting'), { userId: 'cit', status: 'waiting_agent', assignedTo: null, messages: [] });
    await setDoc(doc(db, 'supportChats', 'anas'), { userId: 'cit2', status: 'active_agent', assignedTo: 'ana', assignedAgentName: 'Ana', messages: [] });
    await setDoc(doc(db, 'supportChats', 'bot'), { userId: 'cit3', status: 'bot', messages: [] });
    await setDoc(doc(db, 'supportChats', 'mine-resolved'), { userId: 'cit', status: 'resolved', assignedTo: 'ana', messages: [] });
  });
});

const ana = () => env.authenticatedContext('ana', { role: 'agent', agent: true }).firestore();
const blerim = () => env.authenticatedContext('blerim', { role: 'agent', agent: true }).firestore();
const admin = () => env.authenticatedContext('boss', { role: 'admin', admin: true }).firestore();
const citizen = () => env.authenticatedContext('cit', { role: 'citizen' }).firestore();
const newsEditor = () => env.authenticatedContext('news', { role: 'newsadmin', newsadmin: true }).firestore();

describe('who reads what', () => {
  it('every support agent sees the waiting queue', async () => {
    await assertSucceeds(getDoc(doc(ana(), 'supportChats', 'waiting')));
    await assertSucceeds(getDoc(doc(blerim(), 'supportChats', 'waiting')));
    await assertSucceeds(getDocs(query(collection(blerim(), 'supportChats'), where('status', '==', 'waiting_agent'))));
  });

  it('an accepted conversation is visible only to the agent who took it (and an administrator)', async () => {
    await assertSucceeds(getDoc(doc(ana(), 'supportChats', 'anas')));
    await assertFails(getDoc(doc(blerim(), 'supportChats', 'anas')));
    await assertSucceeds(getDocs(query(collection(ana(), 'supportChats'), where('assignedTo', '==', 'ana'))));
    await assertFails(getDocs(query(collection(blerim(), 'supportChats'), where('assignedTo', '==', 'ana'))));
    await assertSucceeds(getDoc(doc(admin(), 'supportChats', 'anas')));
  });

  it('agents do not read citizens\' conversations with the bot, nor the whole collection', async () => {
    await assertFails(getDoc(doc(ana(), 'supportChats', 'bot')));
    await assertFails(getDocs(collection(ana(), 'supportChats')));
  });

  it('staff outside support see nothing', async () => {
    await assertFails(getDoc(doc(newsEditor(), 'supportChats', 'waiting')));
  });
});

describe('who writes what', () => {
  it('agents cannot take, reply to or close a conversation from the browser', async () => {
    await assertFails(updateDoc(doc(ana(), 'supportChats', 'waiting'), { status: 'active_agent', assignedTo: 'ana' }));
    await assertFails(updateDoc(doc(ana(), 'supportChats', 'anas'), { messages: arrayUnion({ id: 'x', role: 'agent', content: 'hi' }) }));
    await assertFails(updateDoc(doc(admin(), 'supportChats', 'anas'), { assignedTo: 'boss' }));
  });

  it('the citizen writes messages and may ask for an agent again after a closed conversation', async () => {
    await assertSucceeds(updateDoc(doc(citizen(), 'supportChats', 'waiting'), { messages: arrayUnion({ id: 'm1', role: 'user', content: 'Përshëndetje' }) }));
    await assertSucceeds(updateDoc(doc(citizen(), 'supportChats', 'mine-resolved'), { status: 'waiting_agent', assignedTo: null, assignedAgentName: null }));
  });

  it('the citizen cannot pick an agent, mark it accepted or close it', async () => {
    await assertFails(updateDoc(doc(citizen(), 'supportChats', 'waiting'), { assignedTo: 'ana' }));
    await assertFails(updateDoc(doc(citizen(), 'supportChats', 'waiting'), { status: 'active_agent' }));
    await assertFails(updateDoc(doc(citizen(), 'supportChats', 'waiting'), { status: 'resolved' }));
    await assertFails(updateDoc(doc(citizen(), 'supportChats', 'waiting'), { resolvedBy: 'cit' }));
  });

  it('nobody but the server writes the hand-over history', async () => {
    await assertFails(setDoc(doc(admin(), 'supportChats', 'anas', 'events', 'e1'), { action: 'accept' }));
    await assertFails(getDocs(collection(ana(), 'supportChats', 'anas', 'events')));
  });
});
