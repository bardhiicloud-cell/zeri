const fs = require('fs');

let content = fs.readFileSync('src/lib/LanguageContext.tsx', 'utf8');

const newUseEffect = `
  useEffect(() => {
    localStorage.setItem('app_language', language);
    
    // Trigger Google Translate programmatically
    const triggerTranslation = () => {
      const selectElement = document.querySelector('.goog-te-combo');
      if (selectElement) {
        selectElement.value = language;
        selectElement.dispatchEvent(new Event('change'));
      }
    };

    // Sometimes the widget takes a moment to load
    setTimeout(triggerTranslation, 500);
    setTimeout(triggerTranslation, 1500);
    setTimeout(triggerTranslation, 3000);
    
    // If the language is Albanian (the base language), we can clear the google translate cookie
    // to ensure it reverts cleanly, though the select change usually handles it.
    if (language === 'sq') {
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=" + window.location.hostname + "; path=/;";
    }
  }, [language]);
`;

content = content.replace(/useEffect\(\(\) => \{\n\s*localStorage\.setItem\('app_language', language\);\n\s*\}, \[language\]\);/g, newUseEffect);

fs.writeFileSync('src/lib/LanguageContext.tsx', content);
