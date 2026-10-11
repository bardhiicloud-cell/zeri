import fs from 'fs';

const file = fs.readFileSync('server.ts', 'utf8');

const analyzeApiCode = `
  // NEW ENDPOINT: Analyze issue photo for smart categorization
  app.post("/api/analyze-issue", express.json({limit: '50mb'}), async (req, res) => {
    try {
      const { imageBase64, mimeType, lat, lng } = req.body;
      
      const categoriesList = [
        "Komuna - Drejtoria e Infrastrukturës (Rrugë lokale, Gropa, Asfaltim në qytet/fshat)",
        "Ministria e Infrastrukturës (Rrugë magjistrale, Autostrada, Rrugë rajonale)",
        "Komuna - QKMF / Ambulancat lokale (Shëndetësia primare)",
        "Ministria e Shëndetësisë / SHSKUK (QKUK, Spitalet Rajonale)",
        "Komuna - Drejtoria e Arsimit (Kopshte, Shkolla fillore dhe të mesme)",
        "Ministria e Arsimit, Shkencës dhe Teknologjisë (Universitetet, Kurrikulat)",
        "Ujësjellësi Rajonal - KRU (Mungesë uji, Gyp i pëlcitur, Faturim)",
        "Komuna - Kanalizimi lokal dhe Ujërat e zeza (Zgjerim rrjeti, Bllokim i madh)",
        "KEDS / KESCO (Ndërprerje e rrymës, Kabllo e rrezikshme, Fatura)",
        "Komuna - Ndriçimi Publik (Llamba të djegura në rrugë, Errësirë)",
        "Kompania 'Pastrimi' (Vonesa në mbledhjen e bërllokut/mbeturinave)",
        "Komuna - Deponi Ilegale, Ndotje e natyrës, dhe Mjedisi",
        "Policia e Kosovës / Siguria Publike (Krim, Aksident, Prishje e rendit)",
        "Inspekcioni Komunal (Zhurmë në lokale, Tregje, Ndërtime pa leje)",
        "Zjarrfikësit dhe Shpëtimi",
        "Komuna - Qentë endacakë & Kafshët e rrezikshme",
        "Komuna - Transporti Publik (Urbanët, Stacionet, Vonesat)",
        "Komuna - Parqet, Hapësirat e gjelbra, Drunjtë (Mirëmbajtja)",
        "Komuna - Qasja për Personat me Aftësi të Kufizuara (Rampa, Barrierat)"
      ];

      const prompt = \`Je një asistent inteligjent vizual për qytetarët e Kosovës. Analizo këtë foto të një problemi/çështjeje rrugore ose komunale dhe koordinatat (\${lat}, \${lng}).
Përcakto saktësisht kategorinë dhe urgjencën e problemit bazuar NE DETANJE TË FOTOS.
Sigurohu që të dallosh a është përgjegjësi e Komunës apo e Qeverisë/Agjencive (KEDS, KRU, etj).
Zgjedh EXACTLY njërën nga këto kategori (duhet të jetë fiks e njëjtë me tekstin e listës):
\${categoriesList.join('\\n')}

Kthe formati JSON: {
  "category": string,
  "urgency": string ("Kritike", "E lartë", "Mesatare", "E ulët", "Baxhë"),
  "reasoning": string (Një shpjegim i shkurtër pse u zgjodh kjo kategori bazuar në foton specifike.)
}\`;

      const contentsParts: any[] = [];
      if (imageBase64) {
        contentsParts.push({ inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } });
      }
      contentsParts.push({ text: prompt });

      const response = await generateContentWithFallback({
        contents: { parts: contentsParts },
        defaultModel: 'gemini-3.1-flash-image', // Use vision-capable model
        fallbackModels: ['gemini-3.5-flash', 'gemini-3.1-pro-preview'],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              urgency: { type: Type.STRING },
              reasoning: { type: Type.STRING }
            },
            required: ["category", "urgency", "reasoning"]
          }
        },
      });

      const text = response.text;
      const result = text ? JSON.parse(text) : null;
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Gabim gjatë analizës së fotos' });
    }
  });
`;

const updated = file.replace('// 5. AI Duplicate Text & Image Merger', analyzeApiCode + '\n  // 5. AI Duplicate Text & Image Merger');
fs.writeFileSync('server.ts', updated);
