import { describe, expect, it } from 'vitest';
import { createMailerFromEnv, isEmailAddress, parseSender } from '../../server/mailer';
import { buildInstitutionEmail, decideInstitutionEmail, type SendInput } from '../../server/institutionMail';

const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const report = {
  title: 'Gropë në rrugë', description: 'Gropë e thellë.', category: 'Rrugë', urgency: 'E lartë', status: 'Approved', trackingId: 'ZQ-1001',
  location: { municipality: 'Pejë', address: 'Rr. Bajram Curri' },
  media: [{ type: 'image', url: 'https://cdn.example/a.jpg' }, { type: 'image', url: 'javascript:alert(1)' }],
  // These must never appear in the email:
  authorName: 'Emri Sekret', authorEmail: 'sekret@x.test', authorId: 'u-secret',
};
const contact = { municipality: 'Pejë', institution: 'Drejtoria e Infrastrukturës', name: 'Z. Hoxha', email: 'hoxha@peja.test' };
const staff = { uid: 's', role: 'superadmin', municipality: '', permissions: [] as string[], plan: 'pro' };
const run = (patch: Partial<SendInput>) =>
  decideInstitutionEmail({ actor: staff, report, contact, note: '', recent: [], nowMs: NOW, ...patch });

describe('decideInstitutionEmail', () => {
  it('lets staff and agents send an approved report to a verified contact', () => {
    expect(run({})).toMatchObject({ outcome: 'allow', to: 'hoxha@peja.test', institution: 'Drejtoria e Infrastrukturës' });
    expect(run({ actor: { ...staff, role: 'agent' } }).outcome).toBe('allow');
  });

  it('lets a municipality send only with the Pro plan and only its own reports', () => {
    const muni = { uid: 'k', role: 'municipality', municipality: 'Pejë', permissions: [] as string[] };
    expect(run({ actor: { ...muni, plan: 'standard' } })).toMatchObject({ outcome: 'deny', status: 403, code: 'PLAN_REQUIRED' });
    expect(run({ actor: { ...muni, plan: 'pro' } }).outcome).toBe('allow');
    expect(run({ actor: { ...muni, municipality: 'Gjilan', plan: 'pro' } })).toMatchObject({ outcome: 'deny', status: 404 });
  });

  it('refuses monitors, citizens and anonymous roles', () => {
    for (const role of ['monitor', 'citizen', '']) {
      expect(run({ actor: { ...staff, role } }), role).toMatchObject({ outcome: 'deny', status: 403 });
    }
  });

  it('sends only what is already public record', () => {
    for (const status of ['Pending Review', 'Rejected', 'Draft']) {
      expect(run({ report: { ...report, status } }), status).toMatchObject({ outcome: 'deny', status: 409 });
    }
    for (const status of ['Approved', 'In Progress', 'Resolved']) expect(run({ report: { ...report, status } }).outcome, status).toBe('allow');
  });

  it('sends only to a verified contact of the same area (or the whole country)', () => {
    expect(run({ contact: null })).toMatchObject({ outcome: 'deny', status: 404 });
    expect(run({ contact: { ...contact, email: 'not-an-email' } })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ contact: { ...contact, municipality: 'Gjilan' } })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ contact: { ...contact, municipality: 'Kosovë' } }).outcome).toBe('allow');
  });

  it('does not send the same report to the same address twice in 24 hours', () => {
    expect(run({ recent: [{ to: 'HOXHA@peja.test', atMs: NOW - 3_600_000 }] })).toMatchObject({ outcome: 'deny', status: 409, code: 'DUPLICATE' });
    expect(run({ recent: [{ to: 'hoxha@peja.test', atMs: NOW - 25 * 3_600_000 }] }).outcome).toBe('allow');
    expect(run({ recent: [{ to: 'other@peja.test', atMs: NOW - 60_000 }] }).outcome).toBe('allow');
  });

  it('limits the note', () => {
    expect(run({ note: 'x'.repeat(601) })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ note: 'Urgjente, ka ujë në rrugë.' })).toMatchObject({ outcome: 'allow', note: 'Urgjente, ka ujë në rrugë.' });
  });
});

describe('buildInstitutionEmail', () => {
  const mail = buildInstitutionEmail(report, contact, { reportId: 'r1', baseUrl: 'https://zeri.example/', note: 'Urgjente.' });

  it('carries the report: code, title, place, description, photos and the note', () => {
    expect(mail.subject).toBe('Raportim qytetar ZQ-1001: Gropë në rrugë');
    for (const part of ['ZQ-1001', 'Rr. Bajram Curri', 'Gropë e thellë.', 'https://cdn.example/a.jpg', 'Urgjente.', 'Z. Hoxha', 'https://zeri.example/detailed-registry?report=r1']) {
      expect(mail.text, part).toContain(part);
    }
  });

  it('never carries who reported it', () => {
    for (const secret of ['Emri Sekret', 'sekret@x.test', 'u-secret']) expect(mail.text).not.toContain(secret);
  });

  it('drops non-http media links', () => {
    expect(mail.text).not.toContain('javascript:');
  });
});

describe('mailer', () => {
  const ok = { ok: true, status: 202, text: async () => '', headers: { get: () => 'msg-1' } };
  const record = () => {
    const calls: Array<{ url: string; init: any }> = [];
    const fetchImpl = async (url: string, init: any) => { calls.push({ url, init }); return ok; };
    return { calls, fetchImpl };
  };
  const base = { MAIL_API_KEY: 'key-123', MAIL_FROM: 'Zëri <no-reply@zeri.test>' };

  it('is not configured without a provider, a key and a sender, and says so', async () => {
    for (const env of [{}, { MAIL_PROVIDER: 'sendgrid' }, { ...base }, { MAIL_PROVIDER: 'sendgrid', MAIL_API_KEY: 'k', MAIL_FROM: 'junk' }, { ...base, MAIL_PROVIDER: 'mailgun' }, { ...base, MAIL_PROVIDER: 'smtp' }]) {
      const mailer = createMailerFromEnv(env as never);
      expect(mailer.configured).toBe(false);
      expect(await mailer.send({ to: 'a@b.test', subject: 's', text: 't' })).toMatchObject({ ok: false, retryable: false });
    }
  });

  it('speaks to SendGrid, Resend and Mailgun in their own format', async () => {
    const message = { to: 'hoxha@peja.test', subject: 'Tema', text: 'Trupi' };

    const sg = record();
    const sendgrid = createMailerFromEnv({ ...base, MAIL_PROVIDER: 'sendgrid' } as never, sg.fetchImpl as never);
    expect(await sendgrid.send(message)).toMatchObject({ ok: true, provider: 'sendgrid', messageId: 'msg-1' });
    expect(sg.calls[0].url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(sg.calls[0].init.headers.Authorization).toBe('Bearer key-123');
    expect(JSON.parse(sg.calls[0].init.body)).toMatchObject({ personalizations: [{ to: [{ email: 'hoxha@peja.test' }] }], from: { email: 'no-reply@zeri.test', name: 'Zëri' }, subject: 'Tema' });

    const rs = record();
    await createMailerFromEnv({ ...base, MAIL_PROVIDER: 'resend' } as never, rs.fetchImpl as never).send(message);
    expect(rs.calls[0].url).toBe('https://api.resend.com/emails');
    expect(JSON.parse(rs.calls[0].init.body)).toMatchObject({ from: 'Zëri <no-reply@zeri.test>', to: ['hoxha@peja.test'] });

    const mg = record();
    await createMailerFromEnv({ ...base, MAIL_PROVIDER: 'mailgun', MAILGUN_DOMAIN: 'mg.zeri.test', MAILGUN_REGION: 'eu' } as never, mg.fetchImpl as never).send(message);
    expect(mg.calls[0].url).toBe('https://api.eu.mailgun.net/v3/mg.zeri.test/messages');
    expect(mg.calls[0].init.headers.Authorization).toBe(`Basic ${Buffer.from('api:key-123').toString('base64')}`);
    expect(new URLSearchParams(mg.calls[0].init.body).get('to')).toBe('hoxha@peja.test');
  });

  it('keeps a newline out of the subject (header injection)', async () => {
    const { calls, fetchImpl } = record();
    await createMailerFromEnv({ ...base, MAIL_PROVIDER: 'resend' } as never, fetchImpl as never).send({ to: 'a@b.test', subject: 'Tema\r\nBcc: x@y.test', text: 't' });
    expect(JSON.parse(calls[0].init.body).subject).not.toMatch(/[\r\n]/);
  });

  it('refuses a bad recipient without calling the provider, and reports provider errors honestly', async () => {
    const { calls, fetchImpl } = record();
    const mailer = createMailerFromEnv({ ...base, MAIL_PROVIDER: 'resend' } as never, fetchImpl as never);
    expect(await mailer.send({ to: 'nope', subject: 's', text: 't' })).toMatchObject({ ok: false, retryable: false });
    expect(calls.length).toBe(0);

    const failing = (status: number) => createMailerFromEnv({ ...base, MAIL_PROVIDER: 'resend' } as never, (async () => ({ ok: false, status, text: async () => 'boom', headers: { get: () => null } })) as never);
    expect(await failing(401).send({ to: 'a@b.test', subject: 's', text: 't' })).toMatchObject({ ok: false, retryable: false });
    expect(await failing(503).send({ to: 'a@b.test', subject: 's', text: 't' })).toMatchObject({ ok: false, retryable: true });
    const down = createMailerFromEnv({ ...base, MAIL_PROVIDER: 'resend' } as never, (async () => { throw new Error('network'); }) as never);
    expect(await down.send({ to: 'a@b.test', subject: 's', text: 't' })).toMatchObject({ ok: false, retryable: true });
  });

  it('validates addresses and senders', () => {
    expect(isEmailAddress('a@b.co')).toBe(true);
    for (const bad of ['', 'a', 'a@b', 'a b@c.co', '<a@b.co>', 5]) expect(isEmailAddress(bad), String(bad)).toBe(false);
    expect(parseSender('Zëri <no-reply@zeri.test>')).toEqual({ name: 'Zëri', email: 'no-reply@zeri.test' });
    expect(parseSender('no-reply@zeri.test')).toEqual({ name: '', email: 'no-reply@zeri.test' });
    expect(parseSender('junk')).toBeNull();
  });
});
