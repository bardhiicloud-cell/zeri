/**
 * Sends ONE test email through the configured provider, to an address you choose.
 *
 *   npm run mail:test -- you@example.com
 *
 * Use it right after setting MAIL_PROVIDER, MAIL_API_KEY and MAIL_FROM (in the
 * environment or `.env.local`). It sends a plain message that says it is a test,
 * and prints what the provider answered. It never prints the API key, never
 * touches reports, contacts or the outbox, and refuses to run without a recipient
 * so it cannot send to anyone by accident.
 */
import { loadEnvironment } from '../server/loadEnv';
import { createMailerFromEnv, isEmailAddress } from '../server/mailer';

loadEnvironment();

const to = process.argv[2] ?? '';
if (!isEmailAddress(to)) {
  console.error('Përdorimi: npm run mail:test -- adresa@juaj.com');
  process.exit(2);
}

const mailer = createMailerFromEnv();
if (!mailer.configured) {
  console.error(
    'Emaili nuk është konfiguruar. Vendosni MAIL_PROVIDER (sendgrid | mailgun | resend), MAIL_API_KEY dhe MAIL_FROM' +
      ' (për Mailgun edhe MAILGUN_DOMAIN). Shih .env.example.'
  );
  process.exit(1);
}

const stamp = new Date().toISOString();
const result = await mailer.send({
  to,
  subject: `Prova e emailit nga Zëri i Qytetarëve (${stamp})`,
  text: [
    'Ky është një mesazh prove nga platforma Zëri i Qytetarëve.',
    '',
    `Ofruesi: ${mailer.provider}`,
    `Koha: ${stamp}`,
    '',
    'Nëse e lexoni këtë, dërgimi i emailit te institucionet punon. Nuk duhet të bëni asgjë.',
  ].join('\n'),
});

if (result.ok) {
  console.log(`U dërgua me ${result.provider}${result.messageId ? ` (id ${result.messageId})` : ''}. Kontrolloni kutinë e ${to} (edhe spam).`);
} else {
  console.error(`Dështoi: ${result.error}${result.retryable ? ' (mund të riprovohet)' : ''}`);
  process.exit(1);
}
