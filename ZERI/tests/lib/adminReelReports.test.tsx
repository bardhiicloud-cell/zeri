// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  fetchOpenReelReports: vi.fn(),
  fetchReelForReview: vi.fn(),
  setReelHidden: vi.fn(),
  resolveReelReports: vi.fn(),
  deleteDoc: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../../src/lib/firebase', () => ({ auth: { currentUser: { uid: 'staff1' } }, db: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({ deleteDoc: mocks.deleteDoc, doc: (..._a: unknown[]) => ({ path: 'ref' }) }));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock('../../src/lib/store', () => ({ useStore: (sel: any) => sel({ currentUser: { id: 'staff1', role: 'agent' } }) }));
vi.mock('../../src/lib/reelsSocial', async () => {
  const actual = await vi.importActual<any>('../../src/lib/reelsSocial').catch(() => null);
  return {
    // Keep the real grouping logic: it is part of what the screen depends on.
    groupReportsByReel: actual?.groupReportsByReel ?? ((reports: any[]) => {
      const m = new Map<string, any[]>();
      reports.forEach((r) => m.set(r.reelId, [...(m.get(r.reelId) ?? []), r]));
      return [...m.entries()].map(([reelId, list]) => ({ reelId, reports: list })).sort((a, b) => b.reports.length - a.reports.length);
    }),
    fetchOpenReelReports: mocks.fetchOpenReelReports,
    fetchReelForReview: mocks.fetchReelForReview,
    setReelHidden: mocks.setReelHidden,
    resolveReelReports: mocks.resolveReelReports,
  };
});

const { default: AdminReelReports } = await import('../../src/components/admin/AdminReelReports');

const report = (id: string, reelId: string, reason = 'spam', details = '') => ({
  id, reelId, reporterId: `r-${id}`, reason, details, status: 'open' as const, createdAtMs: 1_700_000_000_000,
});
const reel = (id: string, extra: Record<string, unknown> = {}) => ({
  id, authorId: 'a1', authorName: 'Nora', authorAvatar: null, mediaUrl: 'https://x.test/v.mp4', caption: `caption ${id}`,
  hashtags: [], durationSec: 5, likedBy: [], createdAtMs: 1, isHidden: false, ...extra,
});

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.setReelHidden.mockResolvedValue(undefined);
  mocks.resolveReelReports.mockResolvedValue(undefined);
  mocks.deleteDoc.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

describe('AdminReelReports', () => {
  it('shows an empty state when nothing is reported', async () => {
    mocks.fetchOpenReelReports.mockResolvedValue([]);
    render(<AdminReelReports />);
    expect(await screen.findByText('Nuk ka raportime të hapura.')).toBeTruthy();
  });

  it('shows an actionable error when the queue cannot be read', async () => {
    mocks.fetchOpenReelReports.mockRejectedValue(new Error('permission-denied'));
    render(<AdminReelReports />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('lists one card per reel with counts, most-reported first', async () => {
    mocks.fetchOpenReelReports.mockResolvedValue([report('1', 'b'), report('2', 'a', 'abuse', 'Fyerje'), report('3', 'a')]);
    mocks.fetchReelForReview.mockImplementation(async (id: string) => reel(id));
    render(<AdminReelReports />);
    const items = await screen.findAllByRole('listitem', {}, { timeout: 3000 }).then((all) => all.filter((li) => li.className.includes('rounded-2xl')));
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('caption a')).toBeTruthy();
    expect(within(items[0]).getByText(/2\s+raportime/)).toBeTruthy();
    expect(within(items[0]).getByText(/Fyerje/)).toBeTruthy();
    expect(mocks.fetchReelForReview).toHaveBeenCalledTimes(2); // one read per reel, not per report
  });

  it('hides a reel, closes its reports and removes the card', async () => {
    mocks.fetchOpenReelReports.mockResolvedValue([report('1', 'a'), report('2', 'a')]);
    mocks.fetchReelForReview.mockResolvedValue(reel('a'));
    render(<AdminReelReports />);
    fireEvent.click(await screen.findByRole('button', { name: /Fshih/ }));
    await waitFor(() => expect(mocks.setReelHidden).toHaveBeenCalledWith('a', true, 'staff1', 'spam'));
    expect(mocks.resolveReelReports).toHaveBeenCalledTimes(1);
    expect(mocks.resolveReelReports.mock.calls[0][0]).toHaveLength(2);
    await waitFor(() => expect(screen.queryByText('caption a')).toBeNull());
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it('keeps a reel: only closes the reports', async () => {
    mocks.fetchOpenReelReports.mockResolvedValue([report('1', 'a')]);
    mocks.fetchReelForReview.mockResolvedValue(reel('a'));
    render(<AdminReelReports />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mbaje' }));
    await waitFor(() => expect(mocks.resolveReelReports).toHaveBeenCalled());
    expect(mocks.setReelHidden).not.toHaveBeenCalled();
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
  });

  it('deletes only after confirmation', async () => {
    mocks.fetchOpenReelReports.mockResolvedValue([report('1', 'a')]);
    mocks.fetchReelForReview.mockResolvedValue(reel('a'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<AdminReelReports />);
    const del = await screen.findByRole('button', { name: /Fshi$/ });
    fireEvent.click(del);
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
    fireEvent.click(del);
    await waitFor(() => expect(mocks.deleteDoc).toHaveBeenCalledTimes(1));
    expect(mocks.resolveReelReports).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('does not offer Hide on an already hidden reel, and handles a missing reel', async () => {
    mocks.fetchOpenReelReports.mockResolvedValue([report('1', 'a'), report('2', 'gone')]);
    mocks.fetchReelForReview.mockImplementation(async (id: string) => (id === 'a' ? reel('a', { isHidden: true }) : null));
    render(<AdminReelReports />);
    expect(await screen.findByText('Tashmë i fshehur')).toBeTruthy();
    expect(screen.getByText('Reel-i nuk ekziston më')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: /Fshih/ })).toHaveLength(0);
  });

  it('reports a failed action and keeps the card', async () => {
    mocks.fetchOpenReelReports.mockResolvedValue([report('1', 'a')]);
    mocks.fetchReelForReview.mockResolvedValue(reel('a'));
    mocks.setReelHidden.mockRejectedValue(new Error('permission-denied'));
    render(<AdminReelReports />);
    fireEvent.click(await screen.findByRole('button', { name: /Fshih/ }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.resolveReelReports).not.toHaveBeenCalled();
    expect(screen.getByText('caption a')).toBeTruthy();
  });
});
