import { describe, expect, it } from 'vitest';
import {
  adRequestItem,
  muniRequestItem,
  newsTipItem,
  chatItem,
  countByKind,
  donationItem,
  filterInbox,
  isOverdueItem,
  healthItem,
  priority,
  reportItem,
  shortageItem,
  sortInbox,
  toIso,
  workFactItem,
  type InboxItem,
  type ReportLike,
} from '../../src/lib/adminInbox';

const NOW = Date.parse('2026-10-11T12:00:00.000Z');
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();
const ahead = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

const report = (over: Partial<ReportLike> = {}): ReportLike => ({
  id: 'r1',
  title: 'Gropa në rrugë',
  status: 'Pending Review',
  urgency: 'Mesatare',
  category: 'Infrastrukturë',
  createdAt: ago(5),
  location: { municipality: 'Prishtinë' },
  ...over,
});

describe('reportItem', () => {
  it('lists a report waiting for its first review', () => {
    const item = reportItem(report(), ahead(48), NOW)!;
    expect(item.kind).toBe('report');
    expect(item.reason).toBe('Pret shqyrtimin e parë');
    expect(item.section).toBe('reports');
    expect(item.key).toBe('report:r1');
  });

  it('lists an open report that is past its deadline, whatever its stage', () => {
    const item = reportItem(report({ status: 'In Progress' }), ago(10), NOW)!;
    expect(item.reason).toBe('Afati i përgjigjes ka kaluar');
  });

  it('lists a critical open report even when it is on time', () => {
    const item = reportItem(report({ status: 'Assigned', urgency: 'Kritike' }), ahead(100), NOW)!;
    expect(item.reason).toBe('Urgjencë kritike');
    expect(item.urgency).toBe('critical');
  });

  it('leaves out a healthy in-progress report, and any closed report', () => {
    expect(reportItem(report({ status: 'In Progress' }), ahead(100), NOW)).toBeNull();
    expect(reportItem(report({ status: 'Resolved', urgency: 'Kritike' }), ago(500), NOW)).toBeNull();
    expect(reportItem(report({ status: 'Rejected' }), ago(500), NOW)).toBeNull();
  });
});

describe('other kinds', () => {
  it('lists only pending work facts', () => {
    expect(workFactItem({ id: 'w', review: 'pending', description: 'Rregullim', municipality: 'Pejë', createdAt: ago(3) })?.reason)
      .toBe('Pret verifikimin e stafit');
    expect(workFactItem({ id: 'w', review: 'confirmed' })).toBeNull();
  });

  it('flags an urgent health case with no hospital notified, and never exposes the person', () => {
    const item = healthItem({
      id: 'h', urgency: 'Urgjente', hospitalNotified: false, category: 'Kancer / Onkologji',
      municipality: 'Gjakovë', fullName: 'Arben Berisha', diagnosis: 'Sekret mjekësor', createdAt: ago(2),
    })!;
    expect(item.urgency).toBe('critical');
    expect(item.reason).toBe('Urgjent — spitali nuk është njoftuar');
    const everything = JSON.stringify(item);
    expect(everything).not.toContain('Arben');
    expect(everything).not.toContain('Sekret');
  });

  it('skips a notified, non-pending health case', () => {
    expect(healthItem({ id: 'h', urgency: 'Urgjente', hospitalNotified: true, status: 'verified' })).toBeNull();
    expect(healthItem({ id: 'h', urgency: 'Mesatare', status: 'verified' })).toBeNull();
  });

  it('lists a pending health case that is not urgent as normal priority', () => {
    expect(healthItem({ id: 'h', urgency: 'Mesatare', status: 'pending', category: 'Diabet me Komplikime' })?.urgency).toBe('normal');
  });

  it('lists pending shortages, waiting chats, pending donations and ad requests only', () => {
    expect(shortageItem({ id: 's', status: 'pending', medicineName: 'Insulinë' })?.kind).toBe('shortage');
    expect(shortageItem({ id: 's', status: 'verified' })).toBeNull();
    expect(chatItem({ id: 'c', status: 'waiting_agent', userName: 'Nora' })?.urgency).toBe('high');
    expect(chatItem({ id: 'c', status: 'active_agent' })).toBeNull();
    expect(donationItem({ id: 'd', status: 'pending', title: 'Ndihmë' })?.section).toBe('donations');
    expect(donationItem({ id: 'd', status: 'approved' })).toBeNull();
    expect(adRequestItem({ id: 'a', status: 'pending', title: 'Reklamë' })?.section).toBe('ads');
    expect(adRequestItem({ id: 'a', status: 'done' })).toBeNull();
  });
});

describe('toIso', () => {
  it('reads strings, Firestore timestamps and seconds objects', () => {
    expect(toIso('2026-01-01T00:00:00.000Z')).toBe('2026-01-01T00:00:00.000Z');
    expect(toIso({ toDate: () => new Date('2026-01-02T00:00:00.000Z') })).toBe('2026-01-02T00:00:00.000Z');
    expect(toIso({ seconds: 1767225600 })).toBe('2026-01-01T00:00:00.000Z');
    expect(toIso(undefined)).toBe('');
  });
});

const item = (over: Partial<InboxItem>): InboxItem => ({
  key: over.key ?? 'k',
  kind: 'report', recordId: 'x', title: 't', subtitle: '', reason: '',
  urgency: 'normal', createdAt: ago(1), section: 'reports',
  ...over,
});

describe('sortInbox', () => {
  it('puts overdue first, then critical, then soonest due, then longest waiting', () => {
    const items = [
      item({ key: 'old-normal', createdAt: ago(100) }),
      item({ key: 'critical', urgency: 'critical', createdAt: ago(2) }),
      item({ key: 'due-soon', dueAt: ahead(3), createdAt: ago(2) }),
      item({ key: 'overdue', dueAt: ago(1), createdAt: ago(2) }),
      item({ key: 'due-later', dueAt: ahead(300), createdAt: ago(2) }),
    ];
    expect(sortInbox(items, NOW).map(i => i.key)).toEqual(['overdue', 'critical', 'due-soon', 'due-later', 'old-normal']);
  });

  it('ranks the more overdue item above the less overdue one', () => {
    const items = [item({ key: 'a', dueAt: ago(5) }), item({ key: 'b', dueAt: ago(50) })];
    expect(sortInbox(items, NOW).map(i => i.key)).toEqual(['b', 'a']);
  });

  it('breaks exact ties by key so the order is stable between renders', () => {
    const items = [item({ key: 'b', createdAt: ago(5) }), item({ key: 'a', createdAt: ago(5) })];
    expect(sortInbox(items, NOW).map(i => i.key)).toEqual(['a', 'b']);
  });

  it('does not mutate its input and tolerates a bad date', () => {
    const items = [item({ key: 'x', createdAt: 'garbage' })];
    expect(() => sortInbox(items, NOW)).not.toThrow();
    expect(items).toHaveLength(1);
    expect(priority(item({ createdAt: '' }), NOW)).toBe(0);
  });
});

describe('countByKind and filterInbox', () => {
  const items = [
    item({ key: '1', kind: 'report', municipality: 'Pejë' }),
    item({ key: '2', kind: 'report', municipality: 'Prizren' }),
    item({ key: '3', kind: 'chat' }),
  ];

  it('counts every kind, including empty ones', () => {
    const counts = countByKind(items);
    expect(counts.report).toBe(2);
    expect(counts.chat).toBe(1);
    expect(counts.health).toBe(0);
  });

  it('filters by kind and by a municipality predicate', () => {
    expect(filterInbox(items, { kind: 'chat' }).map(i => i.key)).toEqual(['3']);
    expect(filterInbox(items, { kind: '' }).length).toBe(3);
    const peje = filterInbox(items, { inMunicipality: i => !i.municipality || i.municipality === 'Pejë' });
    expect(peje.map(i => i.key)).toEqual(['1', '3']);
  });
});

describe('one definition of "overdue"', () => {
  it('marks a report overdue when its stored status says so, even if the clock deadline is ahead', () => {
    const item = reportItem(report({ status: 'Overdue' }), ahead(2), NOW)!;
    expect(item.overdue).toBe(true);
    expect(item.reason).toBe('Afati i përgjigjes ka kaluar');
  });

  it('counts that report as overdue and sorts it above a merely critical one', () => {
    const stored = reportItem(report({ id: 'a', status: 'Overdue' }), ahead(2), NOW)!;
    const critical = reportItem(report({ id: 'b', status: 'Pending Review', urgency: 'Kritike' }), ahead(40), NOW)!;
    expect(isOverdueItem(stored, NOW)).toBe(true);
    expect(isOverdueItem(critical, NOW)).toBe(false);
    expect(sortInbox([critical, stored], NOW).map(i => i.recordId)).toEqual(['a', 'b']);
  });

  it('treats a passed deadline as overdue without the stored status', () => {
    const item = reportItem(report({ status: 'In Progress' }), ago(5), NOW)!;
    expect(item.overdue).toBe(true);
  });

  it('leaves an on-time pending report not overdue', () => {
    expect(reportItem(report(), ahead(30), NOW)!.overdue).toBe(false);
  });
});


describe('muniRequestItem', () => {
  it('lists a pending municipality request in the section that answers it', () => {
    const item = muniRequestItem({ id: 'm1', status: 'pending', kind: 'dispute', municipality: 'Pejë', reportTitle: 'Gropë', at: '2026-10-12T00:00:00.000Z' });
    expect(item).toMatchObject({ key: 'munirequest:m1', kind: 'munirequest', section: 'workfacts', municipality: 'Pejë', urgency: 'normal', title: 'Gropë' });
    expect(item?.subtitle).toContain('Kundërshtim');
  });

  it('treats a removal request as more urgent, and skips anything already decided', () => {
    expect(muniRequestItem({ id: 'm2', status: 'pending', kind: 'request_removal' })?.urgency).toBe('high');
    for (const status of ['accepted', 'declined', 'published']) expect(muniRequestItem({ id: 'm3', status })).toBeNull();
  });
});

describe('newsTipItem', () => {
  it('lists a citizen news tip nobody has picked up, and drops the ones already handled', () => {
    const tip = { id: 't1', status: 'submitted', title: 'Rrugë e mbyllur pa lajmërim', category: 'Infrastrukturë', municipality: 'Pejë', createdAt: ago(5) };
    const item = newsTipItem(tip);
    expect(item).toMatchObject({ key: 'newstip:t1', kind: 'newstip', section: 'workflow', municipality: 'Pejë', urgency: 'normal' });
    expect(item?.subtitle).toBe('Infrastrukturë · Pejë');
    for (const status of ['in_review', 'published', 'rejected']) expect(newsTipItem({ ...tip, status })).toBeNull();
  });
});
