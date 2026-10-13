// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  reportTargetApi: vi.fn(),
  listScheduledApi: vi.fn(),
  cancelScheduledApi: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock('../../src/lib/forumReportsApi', async () => {
  const actual = await vi.importActual<any>('../../src/lib/forumReportsApi');
  return { ...actual, reportTargetApi: mocks.reportTargetApi };
});
vi.mock('../../src/lib/forumScheduleApi', () => ({ listScheduledApi: mocks.listScheduledApi, cancelScheduledApi: mocks.cancelScheduledApi }));

const { PostGallery } = await import('../../src/components/forum/PostGallery');
const { ReportTargetSheet } = await import('../../src/components/forum/ReportTargetSheet');
const { ScheduledPostsSheet } = await import('../../src/components/forum/ScheduledPostsSheet');
const { SponsoredPostBar } = await import('../../src/components/forum/SponsoredPostBar');

beforeEach(() => Object.values(mocks).forEach((m) => m.mockReset()));
afterEach(() => cleanup());

describe('PostGallery', () => {
  it('renders nothing without photos and one plain image for a single photo', () => {
    const { container, rerender } = render(<PostGallery urls={[]} />);
    expect(container.innerHTML).toBe('');
    rerender(<PostGallery urls={['https://x.test/1.jpg']} />);
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a grid for several photos and a viewer that walks through all of them', () => {
    render(<PostGallery urls={['https://x.test/1.jpg', 'https://x.test/2.jpg', 'https://x.test/3.jpg']} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    fireEvent.click(screen.getByLabelText('Hap foton 2 / 3'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('2 / 3')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Pas'));
    expect(screen.getByText('3 / 3')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Pas')); // wraps around
    expect(screen.getByText('1 / 3')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Mbyll'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ReportTargetSheet', () => {
  it('sends the chosen reason and details for a comment, then closes', async () => {
    mocks.reportTargetApi.mockResolvedValue({ status: 'reported' });
    const onClose = vi.fn();
    render(<ReportTargetSheet target={{ kind: 'comment', targetId: 'c1', postId: 'p1' }} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Dezinformim'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'gënjeshtër' } });
    fireEvent.click(screen.getByText('Dërgo raportimin'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.reportTargetApi).toHaveBeenCalledWith({ kind: 'comment', targetId: 'c1', postId: 'p1', reason: 'misinformation', details: 'gënjeshtër' });
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it('offers "impersonation" only for accounts and explains a duplicate report', async () => {
    mocks.reportTargetApi.mockResolvedValue({ status: 'duplicate' });
    const { unmount } = render(<ReportTargetSheet target={{ kind: 'comment', targetId: 'c1', postId: 'p1' }} onClose={() => {}} />);
    expect(screen.queryByLabelText('Imiton dikë tjetër')).toBeNull();
    unmount();
    render(<ReportTargetSheet target={{ kind: 'user', targetId: 'u1' }} onClose={() => {}} />);
    expect(screen.getByLabelText('Imiton dikë tjetër')).toBeTruthy();
    fireEvent.click(screen.getByText('Dërgo raportimin'));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Këtë e keni raportuar tashmë.'));
  });

  it('keeps the sheet open and shows the error when sending fails', async () => {
    mocks.reportTargetApi.mockRejectedValue(new Error('Shumë raportime.'));
    const onClose = vi.fn();
    render(<ReportTargetSheet target={{ kind: 'ad', targetId: 'p1', postId: 'p1' }} onClose={onClose} />);
    fireEvent.click(screen.getByText('Dërgo raportimin'));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Shumë raportime.'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ScheduledPostsSheet', () => {
  const item = { id: 's1', content: 'Së shpejti', imageUrls: [], visibility: 'public' as const, publishAtMs: Date.UTC(2026, 9, 20, 9) };

  it('lists scheduled posts and cancels one', async () => {
    mocks.listScheduledApi.mockResolvedValue({ items: [item] });
    mocks.cancelScheduledApi.mockResolvedValue({ ok: true });
    render(<ScheduledPostsSheet onClose={() => {}} />);
    expect(await screen.findByText('Së shpejti')).toBeTruthy();
    fireEvent.click(screen.getByText('Anulo'));
    await waitFor(() => expect(mocks.cancelScheduledApi).toHaveBeenCalledWith('s1'));
    expect(await screen.findByText('Nuk keni postime të planifikuara.')).toBeTruthy();
  });

  it('says so when the list cannot be loaded', async () => {
    mocks.listScheduledApi.mockRejectedValue(new Error('x'));
    render(<ScheduledPostsSheet onClose={() => {}} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});

describe('SponsoredPostBar', () => {
  it('always says sponsored, explains why on request and offers a report only when allowed', () => {
    const onReport = vi.fn();
    render(<SponsoredPostBar postId="p1" adLink="https://shop.example/offer" onReport={onReport} />);
    expect(screen.getByText('Sponsorizuar')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(screen.getByText('Pse e shoh këtë?'));
    expect(screen.getByRole('note').textContent).toMatch(/nuk e targetojmë/);
    fireEvent.click(screen.getByText('Raporto reklamën'));
    expect(onReport).toHaveBeenCalled();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/api/v1/ads/r/p1');
    cleanup();
    render(<SponsoredPostBar postId="p1" adLink="javascript:alert(1)" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('Raporto reklamën')).toBeNull();
  });
});
