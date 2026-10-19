// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../../src/lib/LanguageContext';
import { LANGUAGE_STORAGE_KEY } from '../../src/lib/languageConstants';
import KosovaHubPage from '../../src/pages/heritage/KosovaHubPage';
import KosovaSectionPage from '../../src/pages/heritage/KosovaSectionPage';
import UckArchivePage from '../../src/pages/heritage/UckArchivePage';
import HeritageEntryPage from '../../src/pages/heritage/HeritageEntryPage';
import { HeritageHomeBand } from '../../src/components/heritage/HomeBand';

const mount = (path: string, lang = 'sq') => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<HeritageHomeBand />} />
          <Route path="/kosova" element={<KosovaHubPage />} />
          <Route path="/kosova/:section" element={<KosovaSectionPage />} />
          <Route path="/kosova/:section/:id" element={<HeritageEntryPage />} />
          <Route path="/historia-e-uck" element={<UckArchivePage />} />
          <Route path="/historia-e-uck/:section" element={<UckArchivePage />} />
          <Route path="/historia-e-uck/:section/:id" element={<HeritageEntryPage />} />
          <Route path="*" element={<p>404</p>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
};

beforeEach(() => {
  sessionStorage.clear();
  // No API: the archive must still render from the bundled content.
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Kosovo archive UI', () => {
  it('opens offline from the bundled content with the required headline and all ten chapters', async () => {
    mount('/kosova');
    expect(await screen.findByRole('heading', { level: 1, name: 'KOSOVA' })).toBeTruthy();
    expect(screen.getByText(/Mirë se vini në Kosovë — vendin ku mikpritja është traditë/)).toBeTruthy();
    const chapters = document.querySelectorAll('#hx-chapters li a');
    expect(chapters.length).toBe(10);
  });

  it('shows English to international visitors', async () => {
    mount('/kosova', 'en');
    expect(await screen.findByRole('heading', { level: 1, name: 'KOSOVO' })).toBeTruthy();
    expect(screen.getByText(/Welcome to Kosovo — a country where hospitality is tradition/)).toBeTruthy();
  });

  it('the homepage band is two cards, Kosova and UÇK, linking to both archives', () => {
    mount('/');
    expect(screen.getByRole('heading', { name: 'Kosova — Historia — Turizëm' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'UÇK — Lufta e pastër' })).toBeTruthy();
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/kosova');
    expect(hrefs).toContain('/historia-e-uck');
  });

  it('search finds entries without accents', async () => {
    mount('/kosova');
    const input = await screen.findByRole('searchbox', { name: 'Kërko në arkiv' });
    fireEvent.change(input, { target: { value: 'Rambuje' } });
    expect(await screen.findByText(/Rambujeja dhe dështimi i diplomacisë/)).toBeTruthy();
  });

  it('the chronicle filters by evidence status and by text, and opens an entry in place with its sources', async () => {
    mount('/historia-e-uck/timeline');
    // chapter is a graphic-content chapter? timeline entries include graphic ones → gate first
    const proceed = await screen.findByRole('button', { name: /Vazhdo të lexosh/ });
    fireEvent.click(proceed);
    const status = await screen.findByRole('status');
    const total = Number(/nga (\d+)/.exec(status.textContent ?? '')![1]);
    expect(total).toBeGreaterThanOrEqual(20);

    fireEvent.change(screen.getByLabelText('Filtro kronologjinë'), { target: { value: 'Reçak' } });
    expect(screen.getByRole('status').textContent).toMatch(/Po shfaqen 1 /);

    fireEvent.change(screen.getByLabelText('Filtro kronologjinë'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Statusi i provës'), { target: { value: 'court-finding' } });
    const n = Number(/Po shfaqen (\d+)/.exec(screen.getByRole('status').textContent ?? '')![1]);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(total);

    fireEvent.change(screen.getByLabelText('Statusi i provës'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Filtro kronologjinë'), { target: { value: 'Kumanov' } });
    const toggle = screen.getAllByRole('button', { expanded: false })[0];
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const body = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(within(body).getByText('Burimet')).toBeTruthy();
  });

  it('the sexual-violence chapter asks before it shows anything and shows no images', async () => {
    mount('/historia-e-uck/sexual-violence');
    expect(await screen.findByText('Përmbajtje e rëndë')).toBeTruthy();
    expect(screen.queryByText(/Ligji i vitit 2014/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Vazhdo të lexosh/ }));
    expect(await screen.findByText(/Ligji i vitit 2014 dhe statusi i të mbijetuarve/)).toBeTruthy();
    expect(document.querySelectorAll('img').length).toBe(0);
    expect(screen.getByText('Në rrezik të menjëhershëm telefononi 112.')).toBeTruthy();
  });

  it('labels every entry with its evidence status and states honestly that it is not yet verified', async () => {
    mount('/kosova/pavaresia/deklarata-17-shkurt');
    expect(await screen.findByRole('heading', { level: 1, name: /Deklarata e Pavarësisë, 17 shkurt 2008/ })).toBeTruthy();
    expect(screen.getAllByText('Dokument zyrtar').length).toBeGreaterThan(0);
    expect(screen.getByText(/pret verifikim nga një person i dytë/)).toBeTruthy();
    expect(screen.getAllByText(/lidhja nuk është kontrolluar/).length).toBeGreaterThan(0);
  });

  it('an allegation is visibly marked as not proven', async () => {
    mount('/historia-e-uck/justice/jus-ksc');
    expect((await screen.findAllByText('Pretendim (jo i provuar)')).length).toBeGreaterThan(0);
  });

  it('unknown chapters and entries fall through to the not-found page, not a blank screen', async () => {
    mount('/kosova/nuk-ekziston');
    expect((await screen.findAllByText(/404|nuk u gjet|Faqja/i)).length).toBeGreaterThan(0);
  });
});
