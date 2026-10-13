// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.toastSuccess, error: mocks.toastError } }));

const { StageBoard } = await import('../../src/components/admin/workflow/StageBoard');
import type { BoardItem, MoveCheck } from '../../src/components/admin/workflow/StageBoard';
import type { StageKey } from '../../src/lib/workflowStages';

const item = (id: string, stage: StageKey, title = `Rast ${id}`): BoardItem => ({ id, title, stage, subtitle: 'Prishtinë' });

const ITEMS: BoardItem[] = [
  item('a', 'reported'), item('b', 'reported'), item('c', 'reported'),
  item('d', 'approved'), item('e', 'completed'), item('f', 'rejected'),
];

/** Everything may go anywhere except "c", which is incomplete, and a refusal needs a note. */
const check = (it: BoardItem, target: StageKey): MoveCheck => {
  if (it.id === 'c' && target === 'approved') return { ok: false, reason: 'Mungon fotoja.' };
  return { ok: true, note: target === 'rejected' ? 'required' : 'none' };
};

const setup = (move = vi.fn().mockResolvedValue(undefined)) => {
  const onMoved = vi.fn();
  render(<StageBoard kind="donation" items={ITEMS} check={check} move={move} onMoved={onMoved} />);
  return { move, onMoved };
};

beforeEach(() => { mocks.toastSuccess.mockReset(); mocks.toastError.mockReset(); });
afterEach(cleanup);

describe('StageBoard', () => {
  it('counts every stage in the tabs and starts on the first', () => {
    setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(['Raportuar3', 'Aprovuar1', 'Në pritje0', 'Përgjigje0', 'Përfunduar1', 'Refuzuar1']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('shows finished items under "Përfunduar"', () => {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: /Përfunduar/ }));
    expect(screen.getByText('Rast e')).toBeTruthy();
    expect(screen.queryByText('Rast a')).toBeNull();
  });

  it('selects everything in the stage at once and moves what can move, listing the rest', async () => {
    const { move, onMoved } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Zgjidh të gjitha \(3\)/ }));
    expect(screen.getByText(/3 të zgjedhura/)).toBeTruthy();

    // 2 of the 3 can go to "Aprovuar"; the button says so.
    const toApproved = screen.getAllByRole('button').find(b => b.textContent?.startsWith('Aprovuar') && b.textContent.includes('2/3'));
    expect(toApproved).toBeTruthy();
    fireEvent.click(toApproved!);

    const dialog = screen.getByRole('dialog', { name: /Konfirmo lëvizjen/ });
    expect(within(dialog).getByText(/Do të lëvizin 2 te/)).toBeTruthy();
    expect(within(dialog).getByText(/1 nuk mund të lëvizin/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Konfirmo' }));

    await waitFor(() => expect(move).toHaveBeenCalledTimes(2));
    expect(move.mock.calls.map(c => [c[0].id, c[1]])).toEqual([['a', 'approved'], ['b', 'approved']]);
    await waitFor(() => expect(onMoved).toHaveBeenCalled());
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('2 u lëvizën te “Aprovuar”');
    expect(status.textContent).toContain('Mungon fotoja.');
  });

  it('asks for a note before refusing and sends it with every move', async () => {
    const { move } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Zgjidh të gjitha/ }));
    fireEvent.click(screen.getAllByRole('button').find(b => b.textContent?.startsWith('Refuzuar'))!);

    const dialog = screen.getByRole('dialog', { name: /Konfirmo lëvizjen/ });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Konfirmo' }));
    expect(move).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalled();

    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Nuk është e vërtetë' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Konfirmo' }));
    await waitFor(() => expect(move).toHaveBeenCalledTimes(3));
    expect(move.mock.calls.every(c => c[2] === 'Nuk është e vërtetë')).toBe(true);
  });

  it('keeps going when the server refuses one, and says which', async () => {
    const move = vi.fn(async (it: BoardItem) => { if (it.id === 'b') throw new Error('Dikush tjetër e ndryshoi.'); });
    setup(move);
    fireEvent.click(screen.getByRole('button', { name: /Zgjidh të gjitha/ }));
    fireEvent.click(screen.getAllByRole('button').find(b => b.textContent?.startsWith('Në pritje'))!);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Konfirmo' }));

    const status = await screen.findByRole('status');
    expect(move).toHaveBeenCalledTimes(3);
    expect(status.textContent).toContain('2 u lëvizën te “Në pritje”');
    expect(status.textContent).toContain('Rast b');
    expect(status.textContent).toContain('Dikush tjetër e ndryshoi.');
  });

  it('moves one item with its own forward button', async () => {
    const { move } = setup();
    const row = screen.getByText('Rast a').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: /Lëviz te Aprovuar/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Konfirmo' }));
    await waitFor(() => expect(move).toHaveBeenCalledTimes(1));
    expect(move.mock.calls[0][0].id).toBe('a');
  });

  it('narrows "select all" to what the search shows', () => {
    setup();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rast a' } });
    fireEvent.click(screen.getByRole('button', { name: /Zgjidh të gjitha \(1\)/ }));
    expect(screen.getByText(/1 të zgjedhura/)).toBeTruthy();
  });

  it('disables a target nobody selected can reach', () => {
    render(<StageBoard kind="report" items={[item('c', 'reported')]} check={check} move={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox'));
    const target = screen.getAllByRole('button').find(b => b.textContent?.startsWith('Aprovuar')) as HTMLButtonElement;
    expect(target.disabled).toBe(true);
    expect(target.title).toBe('Mungon fotoja.');
  });
});
