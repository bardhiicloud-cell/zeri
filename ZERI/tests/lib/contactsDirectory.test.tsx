// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ContactsDirectory from '../../src/components/admin/ContactsDirectory';

afterEach(cleanup);

describe('ContactsDirectory', () => {
  it('lists the emergency numbers and the ministries with their verified addresses', () => {
    render(<ContactsDirectory onClose={() => {}} />);
    for (const number of ['112', '192', '193', '194']) expect(screen.getAllByText(number).length).toBeGreaterThan(0);
    expect(screen.getByText('Ministria e Shëndetësisë')).toBeTruthy();
    expect(screen.getByText('msh.info@rks-gov.net')).toBeTruthy();
  });

  it('lists all 38 municipalities on its own tab', () => {
    render(<ContactsDirectory onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /Komunat/ }));
    expect(screen.getAllByRole('listitem').filter(item => /^Komuna /.test(item.textContent ?? ''))).toHaveLength(38);
  });

  it('searches by name, email or number', () => {
    render(<ContactsDirectory onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/Kërko institucion/), { target: { value: '0800 79100' } });
    expect(screen.getByText(/KEDS/)).toBeTruthy();
    expect(screen.queryByText('Ministria e Shëndetësisë')).toBeNull();
  });

  it('says plainly when an institution has no address', () => {
    render(<ContactsDirectory onClose={() => {}} />);
    expect(screen.getAllByText('Pa email').length).toBeGreaterThan(0);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ContactsDirectory onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
