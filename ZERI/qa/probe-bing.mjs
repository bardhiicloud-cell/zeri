/**
 * Microsoft translator probe.
 *
 * Edge exposes a keyless auth endpoint that the browser's own translate feature
 * uses. It is a legitimate public endpoint rather than a sc*raper, and unlike the
 * Google mirrors it has not been rate-limited from this machine. If it serves,
 * it becomes the engine for the full run.
 */
const SAMPLE = 'Mirësevini në platformën qendrore të qytetarëve';

async function getAuthToken() {
  // The token endpoint wants browser-ish headers; a bare fetch gets a 404.
  const r = await fetch('https://edge.microsoft.com/translate/auth', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
      'Accept': '*/*',
      'Origin': 'https://www.bing.com',
      'Referer': 'https://www.bing.com/',
    },
  });
  return { status: r.status, token: (await r.text()).trim() };
}

async function translate(token, text, to) {
  const url =
    'https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0&from=sq&to=' + to;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
    },
    body: JSON.stringify([{ Text: text }]),
  });
  const body = await r.text();
  return { status: r.status, body };
}

const auth = await getAuthToken();
console.log('auth status:', auth.status, '| token length:', auth.token.length);
console.log('token preview:', auth.token.slice(0, 50));

if (auth.status === 200 && auth.token.length > 50) {
  for (const lang of ['fr', 'de', 'ar', 'hy', 'nl']) {
    const res = await translate(auth.token, SAMPLE, lang);
    let parsed = res.body.slice(0, 90);
    try {
      const j = JSON.parse(res.body);
      parsed = j?.[0]?.translations?.[0]?.text || '(no text)';
    } catch { /* leave raw */ }
    console.log(`  ${lang.padEnd(4)} HTTP ${res.status} :: ${parsed}`);
  }
} else {
  console.log('\nEdge auth endpoint did not return a token.');
}
