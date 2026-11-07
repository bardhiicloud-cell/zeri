import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = 'C:/Users/bardh/.gemini/antigravity/scratch/zeri/ZERI';
const PHOTOS_DIR = path.join(ROOT, 'public/heritage/photos');
const EMBLEM_PATH = path.join(ROOT, 'public/heritage/emblema-uck.webp');

// Official Wikimedia Commons filenames to query via Special:FilePath or API
const WIKI_FILES = {
  'haga-hashim-thaci': 'Hashim_Thaçi_2020_(cropped).jpg',
  'haga-kadri-veseli': 'Kadri_Veseli_(cropped).jpg',
  'haga-jakup-krasniqi': 'Jakup_Krasniqi_2012.jpg',
  'haga-rexhep-selimi': 'Rexhep_Selimi.jpg',
  'dheshmor-fehmi-lladrovci': 'Fehmi_Lladrovci_and_Xhevë_Krasniqi-Lladrovci_statue_in_Drenas.jpg',
  'dheshmor-xheve-lladrovci': 'Fehmi_Lladrovci_and_Xhevë_Krasniqi-Lladrovci_statue_in_Drenas.jpg',
  'dheshmor-agim-ramadani': 'Agim_Ramadani.jpg',
  'dheshmor-ilir-konushevci': 'Ilir_Konushevci.jpg',
  'dheshmor-bekim-berisha': 'Bekim_Berisha.jpg',
  'dheshmor-tahir-meha': 'Kulla_e_Tahir_Mehës.jpg',
};

// Existing local base photos we can copy/crop directly for family compounds
const LOCAL_BASE_FOR_FAMILIES = {
  'adem-jashari': 'dheshmor-adem-jashari.webp',
  'familja-jashari': 'prekaz.webp',
  'familja-haradinaj': 'dheshmor-luan-haradinaj.webp',
  'familja-meha': 'dheshmor-nebih-meha.webp',
  'familja-gervalla': 'dheshmor-jusuf-gervalla.webp',
  'familja-pajaziti': 'dheshmor-zahir-pajaziti.webp',
  'familja-ramadani': 'koshare.webp',
};

function escXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchWikiBuffer(fileName) {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=1200`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ZeriQytetareveHeritageBot/1.0 (https://github.com/bardhiicloud-cell/zeri)',
      },
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length < 2000) return null;
    return buf;
  } catch {
    return null;
  }
}

async function writePair(name, inputBuffer, isPortrait = true, position = 'top') {
  const [w, h] = isPortrait ? [960, 1200] : [1600, 1000];
  for (const [suffix, scale] of [['', 1], ['-640', 640 / w]]) {
    await sharp(inputBuffer)
      .rotate()
      .resize(Math.round(w * scale), Math.round(h * scale), {
        fit: 'cover',
        position,
        kernel: 'lanczos3',
      })
      .sharpen({ sigma: 0.5 })
      .webp({ quality: 84, effort: 4 })
      .toFile(path.join(PHOTOS_DIR, `${name}${suffix}.webp`));
  }
  console.log(`✓ Wrote ${name}.webp & ${name}-640.webp`);
}

async function createMuseumPlate(name, { title, subtitle, years, badge, isPortrait = true, bgPhoto = 'prekaz.webp' }) {
  const [w, h] = isPortrait ? [960, 1200] : [1600, 1000];
  const bgPath = path.join(PHOTOS_DIR, bgPhoto);

  // Darken and tint the archival background photograph
  const bgBuf = await sharp(bgPath)
    .resize(w, h, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 0.32, saturation: 0.45 })
    .blur(2.5)
    .toBuffer();

  // Resize UÇK emblem
  const emblemSize = isPortrait ? 240 : 210;
  const emblemBuf = await sharp(EMBLEM_PATH)
    .resize(emblemSize, emblemSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const titleLines = [];
  const words = title.split(/\s+/);
  if (words.length <= 2 || title.length <= 18) {
    titleLines.push(title);
  } else {
    const mid = Math.ceil(words.length / 2);
    titleLines.push(words.slice(0, mid).join(' '));
    titleLines.push(words.slice(mid).join(' '));
  }

  const titleSvg = titleLines
    .map(
      (line, idx) =>
        `<text x="${w / 2}" y="${isPortrait ? 730 + idx * 68 : 610 + idx * 62}" text-anchor="middle" fill="#ffffff" font-family="Georgia, 'Times New Roman', serif" font-size="${isPortrait ? 58 : 54}" font-weight="900" letter-spacing="1">${escXml(line)}</text>`,
    )
    .join('');

  const subY = isPortrait ? 730 + titleLines.length * 68 + 26 : 610 + titleLines.length * 62 + 22;
  const yearsY = subY + 54;

  const overlaySvg = Buffer.from(`
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glow" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#c8102e" stop-opacity="0.42"/>
          <stop offset="55%" stop-color="#2b060d" stop-opacity="0.78"/>
          <stop offset="100%" stop-color="#080305" stop-opacity="0.95"/>
        </radialGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#d4af37" stop-opacity="0.2"/>
          <stop offset="50%" stop-color="#f5d77f" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#d4af37" stop-opacity="0.2"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#glow)"/>
      <rect x="36" y="36" width="${w - 72}" height="${h - 72}" rx="24" fill="none" stroke="url(#gold)" stroke-width="2.5"/>
      <rect x="50" y="50" width="${w - 100}" height="${h - 100}" rx="18" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1"/>
      <text x="${w / 2}" y="${isPortrait ? 125 : 110}" text-anchor="middle" fill="#f5d77f" font-family="Arial, sans-serif" font-size="22" font-weight="800" letter-spacing="6">${escXml((badge || 'USHTRIA ÇLIRIMTARE E KOSOVËS').toUpperCase())}</text>
      <line x1="${w / 2 - 110}" y1="${isPortrait ? 148 : 132}" x2="${w / 2 + 110}" y2="${isPortrait ? 148 : 132}" stroke="url(#gold)" stroke-width="2"/>
      ${titleSvg}
      <text x="${w / 2}" y="${subY}" text-anchor="middle" fill="#ff9aa6" font-family="Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="2">${escXml(subtitle || '')}</text>
      ${years ? `<text x="${w / 2}" y="${yearsY}" text-anchor="middle" fill="#f5d77f" font-family="Georgia, serif" font-size="30" font-weight="700" letter-spacing="3">${escXml(years)}</text>` : ''}
      <text x="${w / 2}" y="${h - 78}" text-anchor="middle" fill="#ffffff" fill-opacity="0.65" font-family="Georgia, serif" font-style="italic" font-size="22">Lavdi e Përjetshme · Arkivi Kombëtar i Kosovës</text>
    </svg>
  `);

  const composed = await sharp(bgBuf)
    .composite([
      { input: overlaySvg, top: 0, left: 0 },
      {
        input: emblemBuf,
        top: isPortrait ? 220 : 185,
        left: Math.round((w - emblemSize) / 2),
      },
    ])
    .webp({ quality: 86 })
    .toBuffer();

  await writePair(name, composed, isPortrait, 'center');
}

async function main() {
  // 1. Copy/crop adem-jashari.webp from existing dheshmor-adem-jashari.webp
  for (const [target, srcFile] of Object.entries(LOCAL_BASE_FOR_FAMILIES)) {
    const srcPath = path.join(PHOTOS_DIR, srcFile);
    const buf = await fs.readFile(srcPath);
    const isPortrait = target === 'adem-jashari';
    await writePair(target, buf, isPortrait, 'top');
  }

  // 2. Try downloading Wikimedia Commons photos first, fallback to Museum Plate
  const hagueLeaders = [
    { id: 'haga-hashim-thaci', title: 'Hashim Thaçi', subtitle: 'Drejtues Politik i UÇK-së · President i Kosovës', years: 'Drejtësi për Çlirimtarët', badge: 'MBROJTJA E LUFTËS SË PASTËR' },
    { id: 'haga-kadri-veseli', title: 'Kadri Veseli', subtitle: 'Bashkëthemelues i UÇK-së · Kryetar i Kuvendit', years: 'Drejtësi për Çlirimtarët', badge: 'MBROJTJA E LUFTËS SË PASTËR' },
    { id: 'haga-jakup-krasniqi', title: 'Jakup Krasniqi', subtitle: 'Zëdhënës i Shtabit të Përgjithshëm të UÇK-së', years: 'Drejtësi për Çlirimtarët', badge: 'MBROJTJA E LUFTËS SË PASTËR' },
    { id: 'haga-rexhep-selimi', title: 'Rexhep Selimi', subtitle: 'Inspektor i Përgjithshëm i UÇK-së · «Dhjetëshi»', years: 'Drejtësi për Çlirimtarët', badge: 'MBROJTJA E LUFTËS SË PASTËR' },
    { id: 'haga-salih-mustafa', title: 'Salih Mustafa', subtitle: 'Komandant «Cali» · Zona Operative e Llapit', years: 'Drejtësi për Çlirimtarët', badge: 'MBROJTJA E LUFTËS SË PASTËR' },
    { id: 'haga-pjeter-shala', title: 'Pjetër Shala', subtitle: 'Komandant «Ujku» · Dukagjin & Pashtrik', years: 'Drejtësi për Çlirimtarët', badge: 'MBROJTJA E LUFTËS SË PASTËR' },
    { id: 'haga-hysni-gucati', title: 'Hysni Gucati', subtitle: 'Luftëtar i UÇK-së · Kryetar i OVL-UÇK', years: 'Drejtësi për Çlirimtarët', badge: 'MBROJTJA E LUFTËS SË PASTËR' },
    { id: 'haga-nasim-haradinaj', title: 'Nasim Haradinaj', subtitle: 'Luftëtar i Koshares · Nënkryetar i OVL-UÇK', years: 'Drejtësi për Çlirimtarët', badge: 'MBROJTJA E LUFTËS SË PASTËR' },
  ];

  for (const leader of hagueLeaders) {
    const wikiFile = WIKI_FILES[leader.id];
    let buf = wikiFile ? await fetchWikiBuffer(wikiFile) : null;
    if (buf) {
      await writePair(leader.id, buf, true, 'top');
    } else {
      await createMuseumPlate(leader.id, { ...leader, isPortrait: true, bgPhoto: 'prekaz.webp' });
    }
  }

  // 3. Remaining families
  const familyPlates = [
    { id: 'familja-lladrovci', title: 'Familja Lladrovci', subtitle: 'Fehmi & Xhevë Lladrovci · Drenas', years: '22 Shtator 1998', bgPhoto: 'prekaz.webp' },
    { id: 'familja-fazliu', title: 'Familja Fazliu', subtitle: 'Fahri & Bahri Fazliu · Llaushë, Llap', years: '1989 · 1998', bgPhoto: 'prekaz.webp' },
    { id: 'familja-krasniqi', title: 'Familja Krasniqi', subtitle: 'Mujë & Ali Krasniqi · Çabiq, Drenicë', years: '14 Dhjetor 1998', bgPhoto: 'prekaz.webp' },
    { id: 'familja-konushevci', title: 'Familja Konushevci', subtitle: 'Ilir Konushevci «Mërgimi» · Llap', years: '9 Maj 1998', bgPhoto: 'koshare.webp' },
  ];

  for (const fam of familyPlates) {
    await createMuseumPlate(fam.id, {
      title: fam.title,
      subtitle: fam.subtitle,
      years: fam.years,
      badge: 'FAMILJET LEGJENDARE TË LIRISË',
      isPortrait: false,
      bgPhoto: fam.bgPhoto,
    });
  }

  // 4. All Martyrs without an existing dheshmor-<id>.webp file
  const martyrsToGenerate = [
    { id: 'edmond-hoxha', title: 'Edmond Hoxha', subtitle: 'Luftëtar i Lirisë · Junik & Pestovë', years: '1975 – 31.01.1997' },
    { id: 'adrian-krasniqi', title: 'Adrian Krasniqi', subtitle: 'Komandant i UÇK-së · Pejë', years: '1972 – 16.10.1997' },
    { id: 'ilir-konushevci', title: 'Ilir Konushevci', subtitle: 'Komandant «Mërgimi» · Themelues i Logjistikës', years: '1969 – 09.05.1998' },
    { id: 'hazir-mala', title: 'Dr. Hazir Mala', subtitle: 'Mjek dhe Luftëtar i Lirisë · Tropojë & UÇK', years: '1941 – 09.05.1998' },
    { id: 'bahri-fazliu', title: 'Bahri Fazliu', subtitle: 'Poet, Ideolog & Luftëtar i Lirisë', years: '1971 – 07.05.1998' },
    { id: 'agim-celaj', title: 'Agim Çelaj', subtitle: 'Komandant «Coli» · Rahovec', years: '1961 – 19.07.1998' },
    { id: 'bekim-berisha', title: 'Bekim Berisha', subtitle: 'Gjeneral «Abeja» · Beteja e Junikut', years: '1966 – 10.08.1998' },
    { id: 'ahmet-krasniqi', title: 'Kolonel Ahmet Krasniqi', subtitle: 'Ministër i Mbrojtjes · Hero i Kosovës', years: '1948 – 21.09.1998' },
    { id: 'fehmi-lladrovci', title: 'Fehmi Lladrovci', subtitle: 'Komandant i Brigadës 114 · Drenicë', years: '1956 – 22.09.1998' },
    { id: 'xheve-lladrovci', title: 'Xhevë Krasniqi-Lladrovci', subtitle: 'Heroinë e Kosovës · Drenicë', years: '1955 – 22.09.1998' },
    { id: 'muje-krasniqi', title: 'Mujë Krasniqi', subtitle: 'Komandant «Kapuçi» · Brigada 113', years: '1967 – 14.12.1998' },
    { id: 'agim-ramadani', title: 'Agim Ramadani', subtitle: 'Komandant «Katana» · Beteja e Koshares', years: '1963 – 11.04.1999' },
    { id: 'ilaz-kodra', title: 'Ilaz Kodra', subtitle: 'Komandant i Brigadës 114 «Fehmi Lladrovci»', years: '1966 – 30.04.1999' },
    { id: 'agim-shala', title: 'Agim Shala', subtitle: 'Komandant në Vërrin · Prizren', years: '1975 – 03.09.1998' },
    { id: 'abedin-rexha', title: 'Abedin Rexha', subtitle: 'Komandant «Sandokani» · Brigada 112', years: '1969 – 08.10.1998' },
    { id: 'besnik-lajci', title: 'Besnik Lajçi', subtitle: 'Brigada 163 «Rugova» · Hajlë', years: '1971 – 19.04.1999' },
    { id: 'albesian-mataj', title: 'Albesian Mataj', subtitle: 'Dëshmor 16-vjeçar · «Shqiponjat e Zeza»', years: '1982 – 28.02.1999' },
    { id: 'bashkim-suka', title: 'Bashkim Suka', subtitle: 'Njësia Speciale · Brigada 125 Prizren', years: '1979 – 11.03.1999' },
    { id: 'malush-ahmeti', title: 'Malush Ahmeti', subtitle: 'Komandant i UÇK-së · Rezallë, Drenicë', years: '1951 – 15.05.1999' },
    { id: 'rasim-kicina', title: 'Rasim Kiçina', subtitle: 'Komandant · Shtabi i Përgjithshëm i UÇK-së', years: '1972 – 30.05.1999' },
    { id: 'myrvete-maksutaj', title: 'Myrvete Maksutaj', subtitle: 'Luftëtare «Drita» · Spitali Ushtarak Pejë', years: '1978 – 13.05.1999' },
    { id: 'elton-zherka', title: 'Elton Zherka', subtitle: 'Luftëtar i Lirisë · Beteja e Junikut, Gjakovë', years: '1977 – 11.08.1998' },
    { id: 'tahir-meha', title: 'Tahir Meha', subtitle: 'Qëndresa e Kullës së Mehajve · Prekaz', years: '1943 – 13.05.1981' },
    { id: 'bardhosh-gervalla', title: 'Bardhosh Gërvalla', subtitle: 'Veprimtar i Lëvizjes Kombëtare', years: '1951 – 17.01.1982' },
    { id: 'fahri-fazliu', title: 'Fahri Fazliu', subtitle: 'Qëndresa e Bregut të Diellit · Prishtinë', years: '1963 – 02.11.1989' },
    { id: 'afrim-zhitia', title: 'Afrim Zhitia', subtitle: 'Udhëheqës i Rezistencës · Llap & Prishtinë', years: '1965 – 02.11.1989' },
  ];

  for (const m of martyrsToGenerate) {
    const photoName = `dheshmor-${m.id}`;
    const wikiFile = WIKI_FILES[photoName];
    let buf = wikiFile ? await fetchWikiBuffer(wikiFile) : null;
    if (buf) {
      await writePair(photoName, buf, true, 'top');
    } else {
      await createMuseumPlate(photoName, {
        title: m.title,
        subtitle: m.subtitle,
        years: m.years,
        badge: 'DËSHMOR I KOMBIT · UÇK',
        isPortrait: true,
        bgPhoto: m.id.includes('ramadani') || m.id.includes('konushevci') ? 'koshare.webp' : 'prekaz.webp',
      });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
