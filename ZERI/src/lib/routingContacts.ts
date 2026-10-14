import type { Recipient } from './responsibility';

/**
 * The bridge between the responsibility registry (data/institutionContacts.ts) and the
 * admin's verified contact directory (`reportRoutingContacts`) that the email route reads.
 *
 * The server only ever sends to an address in that directory, never to one typed in a
 * request. So before a bulk send, each recipient the registry trusts is written there
 * once, under an id both sides can compute. A contact that already exists is never
 * overwritten: whoever corrected it by hand wins over the registry's starting value.
 */
const normalizeKey = (value: string) =>
  value.trim().toLocaleLowerCase('sq-AL').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Same id the admin reports screen uses, so a contact added there is found here. */
export const contactDocumentId = (municipality: string, institution: string) =>
  `${normalizeKey(municipality)}-${normalizeKey(institution)}`
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);

/** The directory entry that answers for this recipient on a report from this municipality. */
export function contactRefFor(recipient: Recipient, reportMunicipality: string): { id: string; municipality: string; institution: string } {
  // A central body answers for the whole country; a municipality only for itself.
  const municipality = recipient.level === 'central' ? 'Kosovë' : reportMunicipality;
  return { id: contactDocumentId(municipality, recipient.name), municipality, institution: recipient.name };
}

export type EnsureResult = 'exists' | 'created' | 'unavailable';

/**
 * Makes sure the directory has the recipient. `unavailable` means this account cannot
 * read or write the directory (only administrators can); the send may still work if an
 * administrator already added the contact.
 */
export async function ensureContact(recipient: Recipient, reportMunicipality: string): Promise<EnsureResult> {
  if (!recipient.email || !recipient.sendable) return 'unavailable';
  const ref = contactRefFor(recipient, reportMunicipality);
  try {
    const { db } = await import('./firebase');
    const { doc, getDoc, setDoc } = await import('firebase/firestore');
    const target = doc(db, 'reportRoutingContacts', ref.id);
    if ((await getDoc(target)).exists()) return 'exists';
    await setDoc(target, {
      name: recipient.office,
      role: 'Adresa zyrtare e institucionit',
      email: recipient.email,
      municipality: ref.municipality,
      institution: ref.institution,
      sourceUrl: recipient.site || '',
      origin: 'registry',
      createdAt: new Date().toISOString(),
    });
    return 'created';
  } catch {
    return 'unavailable';
  }
}
