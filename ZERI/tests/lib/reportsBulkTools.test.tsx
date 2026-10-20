// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Report } from '../../src/types';

const classifyReports = vi.fn();
const sendReportEmail = vi.fn();
const ensureContact = vi.fn();

vi.mock('../../src/lib/reportClassifyApi', () => ({ classifyReports: (...args: unknown[]) => classifyReports(...args) }));
vi.mock('../../src/lib/institutionMailApi', () => ({ sendReportEmail: (...args: unknown[]) => sendReportEmail(...args) }));
vi.mock('../../src/lib/routingContacts', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/routingContacts')>('../../src/lib/routingContacts');
  return { ...actual, ensureContact: (...args: unknown[]) => ensureContact(...args) };
});
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../src/lib/dialogs', () => ({ askConfirm: async () => true, askReason: async () => 'arsye' }));

import { ReportsBulkTools } from '../../src/components/admin/workflow/ReportsBulkTools';

const report = (over: Partial<Report>): Report => ({
  id: 'r1', trackingId: 'ZQ-1', title: 'Gropë', description: 'x', category: 'Rrugë', topicCategory: 'rruge',
  urgency: 'E lartë', status: 'Approved', createdAt: '2026-10-01T10:00:00Z', images: [], upvotes: 0, commentsCount: 0,
  authorId: 'u', authorName: 'Emri Sekret', isAnonymous: false,
  location: { municipality: 'Prishtinë', address: 'Rr. A' },
  ...over,
} as Report);

beforeEach(() => {
  classifyReports.mockReset().mockResolvedValue({ updated: 2, results: [], at: '' });
  sendReportEmail.mockReset().mockResolvedValue({ id: 'm1', status: 'sent' });
  ensureContact.mockReset().mockResolvedValue('exists');
  
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ReportsBulkTools', () => {
  it('lists who answers the selection and warns about reports without a zone', () => {
    render(<ReportsBulkTools reports={[report({ id: 'a', zone: 'urban' }), report({ id: 'b' })]} onChanged={() => {}} />);
    expect(screen.getByText('Komuna Prishtinë')).toBeTruthy();
    expect(screen.getAllByText(/Gati për dërgim/).length).toBeGreaterThan(0);
    expect(screen.getByText(/nuk kanë zonë të caktuar/)).toBeTruthy();
  });

  it('applies only what was chosen, to every selected report', async () => {
    const onChanged = vi.fn();
    render(<ReportsBulkTools reports={[report({ id: 'a' }), report({ id: 'b' })]} onChanged={onChanged} />);
    const apply = screen.getByRole('button', { name: /Apliko te 2 raporte/ });
    expect((apply as HTMLButtonElement).disabled).toBe(true);

    const [topic, , zone] = screen.getAllByRole('combobox');
    fireEvent.focus(topic);
    fireEvent.change(topic, { target: { value: 'infrastruktur' } });
    fireEvent.mouseDown(screen.getByText(/Infrastrukturë$/));
    fireEvent.change(zone, { target: { value: 'urban' } });
    fireEvent.click(apply);

    await waitFor(() => expect(classifyReports).toHaveBeenCalledWith(['a', 'b'], { topicCategory: 'infrastrukture', zone: 'urban' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('sends each approved report to its contact and skips the ones not yet approved', async () => {
    render(<ReportsBulkTools reports={[report({ id: 'a', zone: 'urban' }), report({ id: 'b', zone: 'urban', status: 'Pending Review' })]} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Dërgo me email/ }));

    await waitFor(() => expect(sendReportEmail).toHaveBeenCalledTimes(1));
    expect(sendReportEmail.mock.calls[0][0]).toBe('a');
    expect(sendReportEmail.mock.calls[0][1]).toBe('prishtine-komuna-prishtine');
    await waitFor(() => expect(screen.getByText(/Ende nuk është aprovuar/)).toBeTruthy());
  });

  it('does not offer to send when no recipient has a verified address', () => {
    render(<ReportsBulkTools reports={[report({ id: 'a', zone: 'urban', location: { municipality: 'Prizren', address: '', lat: 0, lng: 0 } })]} onChanged={() => {}} />);
    const send = screen.getByRole('button', { name: /Dërgo me email/ }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    expect(screen.getByText(/Asnjë marrës nuk ka adresë të verifikuar/)).toBeTruthy();
  });

  it('shows the reason when the server refuses a send, and keeps going', async () => {
    sendReportEmail.mockRejectedValueOnce(new Error('Ky raport i është dërguar tashmë këtij kontakti brenda 24 orëve.'));
    render(<ReportsBulkTools reports={[report({ id: 'a', zone: 'urban' }), report({ id: 'b', zone: 'urban' })]} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Dërgo me email/ }));
    await waitFor(() => expect(sendReportEmail).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText(/brenda 24 orëve/)).toBeTruthy());
  });
});
