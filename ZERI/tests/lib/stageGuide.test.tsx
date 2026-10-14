// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { StageBoard } = await import('../../src/components/admin/workflow/StageBoard');
import type { BoardItem } from '../../src/components/admin/workflow/StageBoard';
import { daysSince, nextFlowStage, stageActor } from '../../src/lib/workflowStages';

const item = (id: string, patch: Partial<BoardItem> = {}): BoardItem => ({ id, title: `Rast ${id}`, stage: 'reported', ...patch });
const ok = () => ({ ok: true as const, note: 'none' as const });
const render1 = (items: BoardItem[], kind: 'report' | 'donation' = 'report') =>
  render(<StageBoard kind={kind} items={items} check={ok} move={vi.fn()} />);

afterEach(cleanup);

describe('who acts and what comes next', () => {
  it('names the actor of each open stage per kind, and none for the ends', () => {
    expect(stageActor('report', 'reported')?.who).toBe('Agjenti');
    expect(stageActor('report', 'approved')?.who).toBe('Komuna');
    expect(stageActor('donation', 'waiting')?.who).toBe('Organizatori');
    expect(stageActor('news', 'reported')?.who).toBe('Redaktori');
    expect(stageActor('report', 'completed')).toBeNull();
    expect(stageActor('report', 'rejected')).toBeNull();
  });

  it('knows the next stage and stops at the end of the flow', () => {
    expect(nextFlowStage('reported')).toBe('approved');
    expect(nextFlowStage('responded')).toBe('completed');
    expect(nextFlowStage('completed')).toBeNull();
    expect(nextFlowStage('rejected')).toBeNull();
  });

  it('counts whole days from ISO, Firestore timestamps and seconds, and says null when unknown', () => {
    const now = Date.parse('2026-10-14T12:00:00Z');
    expect(daysSince('2026-10-12T12:00:00Z', now)).toBe(2);
    expect(daysSince({ toDate: () => new Date('2026-10-13T12:00:00Z') }, now)).toBe(1);
    expect(daysSince({ seconds: Date.parse('2026-10-14T00:00:00Z') / 1000 }, now)).toBe(0);
    expect(daysSince('2027-01-01T00:00:00Z', now)).toBe(0); // never negative
    expect(daysSince(undefined, now)).toBeNull();
    expect(daysSince('nonsense', now)).toBeNull();
  });
});

describe('StageBoard guide, rows and sorting', () => {
  it('shows who acts and the next step for the open stage', () => {
    render1([item('a')]);
    const guide = screen.getByTestId('stage-guide');
    expect(within(guide).getByText('Agjenti')).toBeTruthy();
    expect(guide.textContent).toContain('Më pas: Aprovuar');
  });

  it('shows the oldest age, urgent and unheld counts, only when there is something to say', () => {
    render1([item('a', { ageDays: 12, urgent: true, owner: '' }), item('b', { ageDays: 3, owner: 'Ana' })]);
    const guide = screen.getByTestId('stage-guide');
    expect(guide.textContent).toContain('Më e vjetra: 12 ditë');
    expect(guide.textContent).toContain('1 urgjente');
    expect(guide.textContent).toContain('1 pa të zot');
  });

  it('says nothing about owners for kinds that have none', () => {
    render1([item('a', { ageDays: 0 })], 'donation');
    expect(screen.getByTestId('stage-guide').textContent).not.toContain('pa të zot');
    expect(screen.queryByText('Pa të zot')).toBeNull();
  });

  it('marks who holds each row, and flags what nobody holds', () => {
    render1([item('a', { owner: 'Ana Berisha', ageDays: 9 }), item('b', { owner: '', ageDays: 1 })]);
    expect(screen.getByText('Ana Berisha')).toBeTruthy();
    expect(screen.getByText('Pa të zot')).toBeTruthy();
    expect(screen.getByText('9 ditë')).toBeTruthy();
    expect(screen.getByText('1 ditë')).toBeTruthy();
  });

  it('sorts oldest first and urgent first, and keeps the list order by default', () => {
    render1([item('a', { ageDays: 2 }), item('b', { ageDays: 30 }), item('c', { ageDays: 5, urgent: true })]);
    const titles = () => screen.getAllByRole('checkbox').map(c => c.getAttribute('aria-label')?.replace('Zgjidh ', ''));
    expect(titles()).toEqual(['Rast a', 'Rast b', 'Rast c']);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'oldest' } });
    expect(titles()).toEqual(['Rast b', 'Rast c', 'Rast a']);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'newest' } });
    expect(titles()).toEqual(['Rast a', 'Rast c', 'Rast b']);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'urgent' } });
    expect(titles()[0]).toBe('Rast c');
  });

  it('searches by owner too', () => {
    render1([item('a', { owner: 'Ana Berisha' }), item('b', { owner: 'Blerim Gashi' })]);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'blerim' } });
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });
});
