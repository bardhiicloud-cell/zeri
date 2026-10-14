// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Report } from '../../src/types';

const classifyReports = vi.fn();
vi.mock('../../src/lib/reportClassifyApi', () => ({ classifyReports: (...args: unknown[]) => classifyReports(...args) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import ReviewRouting from '../../src/components/admin/ReviewRouting';

const report = (over: Partial<Report> = {}): Report => ({
  id: 'r1', trackingId: 'ZQ-1', title: 'Gropë', description: 'x', category: 'Rrugë', topicCategory: 'rruge',
  urgency: 'E lartë', status: 'Pending Review', createdAt: '2026-10-01T10:00:00Z', images: [], upvotes: 0, commentsCount: 0,
  authorId: 'u', authorName: 'A', isAnonymous: false,
  location: { municipality: 'Prishtinë', address: 'Rr. A', lat: 0, lng: 0 },
  ...over,
} as Report);

beforeEach(() => { classifyReports.mockReset().mockResolvedValue({ updated: 1, results: [], at: '' }); });
afterEach(cleanup);

describe('ReviewRouting', () => {
  it('shows who answers an urban report and that the email is ready', () => {
    render(<ReviewRouting report={report({ zone: 'urban' })} canClassify onClassified={() => {}} />);
    expect(screen.getByText('Komuna Prishtinë')).toBeTruthy();
    expect(screen.getByText('komunaprishtine@rks-gov.net')).toBeTruthy();
    expect(screen.getByText('Email gati')).toBeTruthy();
  });

  it('asks for the zone when it matters and nothing is chosen', () => {
    render(<ReviewRouting report={report()} canClassify onClassified={() => {}} />);
    expect(screen.getByText(/Plotësoni klasifikimin para aprovimit/)).toBeTruthy();
  });

  it('switches the recipient to the state when the zone becomes rural, and saves only what changed', async () => {
    const onClassified = vi.fn();
    render(<ReviewRouting report={report({ zone: 'urban' })} canClassify onClassified={onClassified} />);
    const [, , zone] = screen.getAllByRole('combobox');
    fireEvent.change(zone, { target: { value: 'rural' } });
    expect(screen.getByText(/Ministria e Mjedisit, Planifikimit Hapësinor dhe Infrastrukturës/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Ruaj klasifikimin/ }));
    await waitFor(() => expect(classifyReports).toHaveBeenCalledWith(['r1'], { zone: 'rural' }));
    await waitFor(() => expect(onClassified).toHaveBeenCalledWith('r1', { zone: 'rural' }));
  });

  it('does not offer to change anything to someone who may not classify', () => {
    render(<ReviewRouting report={report({ zone: 'urban' })} canClassify={false} onClassified={() => {}} />);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.getByText('Komuna Prishtinë')).toBeTruthy();
  });
});
