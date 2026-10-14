import { REPORT_TOPICS } from './reportTopics';
import { CENTRAL_BODIES } from '../data/institutionContacts';
import { TOPIC_ROUTES } from './responsibility';

/**
 * Finding the right sector from what a person types: "gropë", "rrymë", "shkolla",
 * "ministria e shëndetësisë". Each result also says who answers it, so choosing a
 * category is also choosing the body, and nobody has to remember which ministry owns what.
 */
export interface SectorOption {
  id: string;
  label: string;
  icon: string;
  /** "Komuna · Drejtoria e Infrastrukturës" or the ministry; for zone topics both. */
  answers: string;
  /** Lower-cased text the search runs over. */
  haystack: string;
}

const fold = (value: string) =>
  value.toLocaleLowerCase('sq-AL').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ë/g, 'e').replace(/ç/g, 'c');

function answersFor(id: keyof typeof TOPIC_ROUTES): string {
  const route = TOPIC_ROUTES[id];
  const ministry = CENTRAL_BODIES[route.central]?.name ?? '';
  if (route.rule === 'municipal') return `Komuna · ${route.office}`;
  if (route.rule === 'central') return ministry;
  return `Komuna (urbane) · ${ministry} (rurale)`;
}

export const SECTOR_OPTIONS: readonly SectorOption[] = REPORT_TOPICS.map(topic => {
  const answers = answersFor(topic.id);
  return {
    id: topic.id,
    label: topic.label,
    icon: topic.icon,
    answers,
    // The ministry is searchable even where the municipality answers first.
    haystack: fold([topic.label, answers, CENTRAL_BODIES[TOPIC_ROUTES[topic.id].central]?.name ?? '', ...topic.keywords].join(' ')),
  };
});

/** Options whose label, keywords or responsible body contain every word typed. */
export function searchSectors(query: string, options: readonly SectorOption[] = SECTOR_OPTIONS): SectorOption[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...options];
  const hits = options.filter(option => words.every(word => option.haystack.includes(word)));
  // A label that starts with what was typed comes first.
  const first = fold(query).trim();
  return hits.sort((a, b) => Number(fold(b.label).startsWith(first)) - Number(fold(a.label).startsWith(first)));
}
