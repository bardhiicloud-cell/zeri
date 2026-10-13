// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HandoverEntry, HandoverPage } from '../../src/lib/reportAssignmentApi';

const mocks = vi.hoisted(() => ({ fetchHandovers: vi.fn() }));
vi.mock('../../src/lib/reportAssignmentApi', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/lib/reportAssignmentApi')>()),
  fetchHandovers: mocks.fetchHandovers,
}));

const { default: HandoverHistoryPanel } = await import('../../src/components/admin/HandoverHistoryPanel');
const { appendHandovers, filterHandovers, personLabel } = await import('../../src/lib/handoverHistory');

const entry = (id: string, patch: Partial<HandoverEntry> = {}): HandoverEntry => ({
  id, kind: 'assign', fromUid: 'a', fromName: 'Ana', toUid: 'b', toName: 'Blerim', byUid: 'o', byName: 'Pronari',
  reason: 'Ana është me leje', at: '2026-01-02T10:00:00.000Z', ...patch,
});
const page = (items: HandoverEntry[], nextBefore: string | null = null): HandoverPage => ({ items, nextBefore });
const open = () => fireEvent.click(screen.getByRole('button', { name: /Historiku i caktimeve/ }));

beforeEach(() => mocks.fetchHandovers.mockReset());
afterEach(cleanup);

describe('HandoverHistoryPanel', () => {
  it('loads nothing until it is opened', () => {
    render(<HandoverHistoryPanel reportId="r1" />);
    expect(mocks.fetchHandovers).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Historiku i caktimeve/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('shows a loading state, then who, from whom, to whom, by whom, when and why', async () => {
    let resolve!: (value: HandoverPage) => void;
    mocks.fetchHandovers.mockReturnValue(new Promise<HandoverPage>(r => { resolve = r; }));
    render(<HandoverHistoryPanel reportId="r1" />);
    open();
    expect(screen.getByText(/Po ngarkohet historiku/)).toBeTruthy();
    resolve(page([entry('1')]));
    await screen.findByText('Ana është me leje');
    expect(screen.getByText('Blerim')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText(/Pronari/)).toBeTruthy();
    expect(screen.getByRole('list').querySelectorAll('time')).toHaveLength(1);
    expect(mocks.fetchHandovers).toHaveBeenCalledWith('r1', { before: null });
  });

  it('says plainly when there is nothing recorded, and invents nothing', async () => {
    mocks.fetchHandovers.mockResolvedValue(page([]));
    render(<HandoverHistoryPanel reportId="r1" />);
    open();
    await screen.findByText(/nuk ka ndryshim mbajtësi të regjistruar/);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('marks missing names as not recorded instead of showing an id or a guess', async () => {
    mocks.fetchHandovers.mockResolvedValue(page([entry('1', { toName: '', byName: '', reason: '' })]));
    render(<HandoverHistoryPanel reportId="r1" />);
    open();
    await screen.findByText(/Pa arsye të shënuar/);
    expect(screen.getAllByText(/nuk është regjistruar/).length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).not.toContain('"b"');
  });

  it('shows the server\'s refusal and retries on request', async () => {
    mocks.fetchHandovers.mockRejectedValueOnce(new Error('Historiku i caktimeve është vetëm për stafin.')).mockResolvedValueOnce(page([entry('1')]));
    render(<HandoverHistoryPanel reportId="r1" />);
    open();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('vetëm për stafin');
    fireEvent.click(screen.getByRole('button', { name: /Provo përsëri/ }));
    await screen.findByText('Ana është me leje');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('pages older entries with the cursor the server gave, without duplicating a repeated one', async () => {
    mocks.fetchHandovers
      .mockResolvedValueOnce(page([entry('1', { at: '2026-01-03T00:00:00.000Z' })], '2026-01-03T00:00:00.000Z'))
      .mockResolvedValueOnce(page([entry('1', { at: '2026-01-03T00:00:00.000Z' }), entry('2', { reason: 'Më e vjetra', at: '2026-01-01T00:00:00.000Z' })]));
    render(<HandoverHistoryPanel reportId="r1" />);
    open();
    fireEvent.click(await screen.findByRole('button', { name: /Ngarko më të vjetrat/ }));
    await screen.findByText('Më e vjetra');
    expect(mocks.fetchHandovers).toHaveBeenLastCalledWith('r1', { before: '2026-01-03T00:00:00.000Z' });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Ngarko më të vjetrat/ })).toBeNull();
  });

  it('filters loaded entries by action', async () => {
    mocks.fetchHandovers.mockResolvedValue(page([entry('1'), entry('2', { kind: 'release', toUid: '', toName: '', reason: 'U lëshua' })]));
    render(<HandoverHistoryPanel reportId="r1" />);
    open();
    await screen.findByText('U lëshua');
    fireEvent.change(screen.getByLabelText(/Filtro sipas veprimit/), { target: { value: 'release' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('U lëshua')).toBeTruthy();
    expect(screen.queryByText('Ana është me leje')).toBeNull();
  });

  it('ignores a slow answer for a report the reviewer already left', async () => {
    let resolveFirst!: (value: HandoverPage) => void;
    mocks.fetchHandovers
      .mockReturnValueOnce(new Promise<HandoverPage>(r => { resolveFirst = r; }))
      .mockResolvedValueOnce(page([entry('2', { reason: 'Raporti i dytë' })]));
    const { rerender } = render(<HandoverHistoryPanel reportId="r1" />);
    open();
    rerender(<HandoverHistoryPanel reportId="r2" />);
    // stays open while stepping through the queue, and reloads for the new report
    await screen.findByText('Raporti i dytë');
    resolveFirst(page([entry('1', { reason: 'Raporti i parë' })]));
    await waitFor(() => expect(screen.queryByText('Raporti i parë')).toBeNull());
    expect(screen.getByText('Raporti i dytë')).toBeTruthy();
  });
});

describe('handover helpers', () => {
  it('filters, appends without duplicates, and labels', () => {
    const a = entry('1'); const b = entry('2', { kind: 'release' });
    expect(filterHandovers([a, b], 'all')).toHaveLength(2);
    expect(filterHandovers([a, b], 'assign')).toEqual([a]);
    expect(appendHandovers([a], [a, b])).toEqual([a, b]);
    expect(personLabel('  ', 'x')).toBe('x');
    expect(personLabel(undefined, 'x')).toBe('x');
    expect(personLabel(' Ana ', 'x')).toBe('Ana');
  });
});
