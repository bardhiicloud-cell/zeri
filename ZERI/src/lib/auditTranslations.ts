/**
 * English and German for the copy added by the public UI/UX audit remediation
 * (report form, map, tracking, registry, statistics, health). Hand-written from
 * the Albanian source and keyed by the exact Albanian text passed to dt().
 *
 * The other 21 languages fall back to Albanian for these strings (see dt()).
 * That is a documented gap, not a silent one: `scripts/find-untranslated-dt.ts`
 * lists what a file still lacks, and `tests/lib/auditTranslations.test.ts`
 * keeps every placeholder consistent between the languages.
 */
export const auditTranslations: Record<string, Record<string, string>> = {
  // ---- /raporto: steps and evidence -------------------------------------
  'Hapat e raportimit': { en: 'Reporting steps', de: 'Schritte der Meldung' },
  'Dëshmia': { en: 'Evidence', de: 'Nachweis' },
  'Detajet dhe vendndodhja': { en: 'Details and location', de: 'Details und Ort' },
  'përfunduar': { en: 'completed', de: 'abgeschlossen' },
  'hapi aktual': { en: 'current step', de: 'aktueller Schritt' },
  'hapi tjetër': { en: 'next step', de: 'nächster Schritt' },
  'Raportim qytetar': { en: 'Citizen report', de: 'Bürgermeldung' },
  'Përshkruani problemin, shënoni vendndodhjen dhe shtoni foto. Do të merrni një Track-ID për ta ndjekur raportin.': {
    en: 'Describe the problem, mark the location and add a photo. You will receive a Track-ID to follow the report.',
    de: 'Beschreiben Sie das Problem, markieren Sie den Ort und fügen Sie ein Foto hinzu. Sie erhalten eine Track-ID, um die Meldung zu verfolgen.',
  },
  'Hapi 1: Shtoni dëshmi': { en: 'Step 1: Add evidence', de: 'Schritt 1: Nachweis hinzufügen' },
  'opsionale': { en: 'optional', de: 'optional' },
  'Një foto, video ose dokument e ndihmon shqyrtimin, por nuk është e detyrueshme. Mund ta dërgoni raportin edhe pa dëshmi.': {
    en: 'A photo, video or document helps the review, but it is not required. You can send the report without evidence.',
    de: 'Ein Foto, Video oder Dokument erleichtert die Prüfung, ist aber nicht erforderlich. Sie können die Meldung auch ohne Nachweis senden.',
  },
  'Zgjidhni skedarë ose tërhiqini këtu': { en: 'Choose files or drag them here', de: 'Dateien auswählen oder hierher ziehen' },
  'Foto, video, audio, PDF, DOC ose TXT · deri në {count} skedarë · deri në {size} secili': {
    en: 'Photo, video, audio, PDF, DOC or TXT · up to {count} files · up to {size} each',
    de: 'Foto, Video, Audio, PDF, DOC oder TXT · bis zu {count} Dateien · je bis zu {size}',
  },
  'Fajlli “{name}” është {size}. Kufiri për çdo skedar është {max}.': {
    en: 'The file “{name}” is {size}. The limit for each file is {max}.',
    de: 'Die Datei „{name}“ ist {size} groß. Das Limit pro Datei beträgt {max}.',
  },
  'Fajlli “{name}” nuk pranohet. Lejohen foto, video, audio, PDF, DOC/DOCX dhe TXT.': {
    en: 'The file “{name}” is not accepted. Allowed: photo, video, audio, PDF, DOC/DOCX and TXT.',
    de: 'Die Datei „{name}“ wird nicht akzeptiert. Erlaubt sind Foto, Video, Audio, PDF, DOC/DOCX und TXT.',
  },
  'Fajlli “{name}” është bosh.': { en: 'The file “{name}” is empty.', de: 'Die Datei „{name}“ ist leer.' },
  'Mund të shtoni deri në {max} skedarë. “{name}” nuk u shtua.': {
    en: 'You can add up to {max} files. “{name}” was not added.',
    de: 'Sie können bis zu {max} Dateien hinzufügen. „{name}“ wurde nicht hinzugefügt.',
  },
  'Dëshmitë e shtuara': { en: 'Added evidence', de: 'Hinzugefügte Nachweise' },
  'Hiq {name}': { en: 'Remove {name}', de: '{name} entfernen' },
  'Nuk u ngarkua': { en: 'Upload failed', de: 'Hochladen fehlgeschlagen' },
  'Vazhdo te detajet dhe vendndodhja': { en: 'Continue to details and location', de: 'Weiter zu Details und Ort' },
  'Vazhdo pa dëshmi': { en: 'Continue without evidence', de: 'Ohne Nachweis fortfahren' },
  'Zëri i Qytetarëve është portal nga komuniteti, për komunitetin. Mund të zgjidhni të mbeteni anonim kur dërgoni një raport.': {
    en: 'Voice of the Citizens is a portal from the community, for the community. You can choose to stay anonymous when you send a report.',
    de: 'Stimme der Bürger ist ein Portal aus der Gemeinschaft für die Gemeinschaft. Beim Senden einer Meldung können Sie anonym bleiben.',
  },

  // ---- /raporto: details --------------------------------------------------
  'Hapi 2: Detajet e problemit': { en: 'Step 2: Details of the problem', de: 'Schritt 2: Details zum Problem' },
  'Po përpunohet...': { en: 'Working...', de: 'Wird verarbeitet...' },
  'Krijim me AI': { en: 'Create with AI', de: 'Mit KI erstellen' },
  '“Krijim me AI” lexon foton e parë dhe sugjeron titullin, përshkrimin, kategorinë dhe urgjencën. Është vetëm ndihmë: i kontrolloni dhe i ndryshoni vetë, dhe raporti mund të dërgohet edhe pa të.': {
    en: '“Create with AI” reads the first photo and suggests a title, description, category and urgency. It is only help: you check and change them yourself, and the report can be sent without it.',
    de: '„Mit KI erstellen“ liest das erste Foto und schlägt Titel, Beschreibung, Kategorie und Dringlichkeit vor. Es ist nur eine Hilfe: Sie prüfen und ändern die Vorschläge selbst, und die Meldung kann auch ohne sie gesendet werden.',
  },
  'Analiza AI lexon vetëm një foto. Kthehuni te hapi 1 dhe shtoni një foto, ose plotësoni fushat vetë.': {
    en: 'AI analysis only reads a photo. Go back to step 1 and add a photo, or fill in the fields yourself.',
    de: 'Die KI-Analyse liest nur ein Foto. Gehen Sie zu Schritt 1 zurück und fügen Sie ein Foto hinzu, oder füllen Sie die Felder selbst aus.',
  },
  'Po analizohet fotoja…': { en: 'Analysing the photo…', de: 'Das Foto wird analysiert…' },
  'Analiza AI nuk është e disponueshme tani. Plotësoni fushat vetë — raporti mund të dërgohet pa të.': {
    en: 'AI analysis is not available right now. Fill in the fields yourself; the report can be sent without it.',
    de: 'Die KI-Analyse ist derzeit nicht verfügbar. Füllen Sie die Felder selbst aus; die Meldung kann auch ohne sie gesendet werden.',
  },
  'AI sugjeroi titullin, përshkrimin dhe kategorinë. Kontrollojini dhe ndryshojini nëse nuk janë të sakta.': {
    en: 'AI suggested a title, description and category. Check them and change them if they are not correct.',
    de: 'Die KI hat Titel, Beschreibung und Kategorie vorgeschlagen. Prüfen Sie sie und ändern Sie sie, falls sie nicht stimmen.',
  },
  'AI nuk gjeti një kategori të sigurt për këtë foto. Zgjidhni kategorinë vetë.': {
    en: 'AI did not find a reliable category for this photo. Choose the category yourself.',
    de: 'Die KI hat für dieses Foto keine verlässliche Kategorie gefunden. Wählen Sie die Kategorie selbst.',
  },
  'Analiza AI dështoi. Provoni përsëri ose plotësoni fushat vetë — raporti mund të dërgohet pa të.': {
    en: 'AI analysis failed. Try again or fill in the fields yourself; the report can be sent without it.',
    de: 'Die KI-Analyse ist fehlgeschlagen. Versuchen Sie es erneut oder füllen Sie die Felder selbst aus; die Meldung kann auch ohne sie gesendet werden.',
  },
  'Rikthyem tekstin e raportit që nisët në këtë skedë. Emri, telefoni dhe dëshmitë nuk ruhen kurrë.': {
    en: 'We restored the report text you started in this tab. Your name, phone number and evidence are never saved.',
    de: 'Wir haben den Text der Meldung wiederhergestellt, den Sie in diesem Tab begonnen haben. Name, Telefonnummer und Nachweise werden nie gespeichert.',
  },
  'Fshi draftin': { en: 'Discard draft', de: 'Entwurf verwerfen' },
  'Rregulloni këto fusha para se ta dërgoni raportin:': {
    en: 'Fix these fields before sending the report:',
    de: 'Korrigieren Sie diese Felder, bevor Sie die Meldung senden:',
  },
  'Fusha “{field}” është e detyrueshme.': { en: 'The field “{field}” is required.', de: 'Das Feld „{field}“ ist ein Pflichtfeld.' },
  'Fusha “{field}” duhet të ketë të paktën {min} karaktere.': {
    en: 'The field “{field}” must have at least {min} characters.',
    de: 'Das Feld „{field}“ muss mindestens {min} Zeichen enthalten.',
  },
  'Numri duhet të jetë në formatin e Kosovës, p.sh. +383 44 123 456.': {
    en: 'The number must be in the Kosovo format, e.g. +383 44 123 456.',
    de: 'Die Nummer muss im kosovarischen Format sein, z. B. +383 44 123 456.',
  },
  'Klasifikimi i raportit': { en: 'Report classification', de: 'Einordnung der Meldung' },
  'Tema e problemit': { en: 'Topic of the problem', de: 'Thema des Problems' },
  'Institucioni që e merr raportin': { en: 'Institution that receives the report', de: 'Institution, die die Meldung erhält' },
  'Siguria dhe emergjencat': { en: 'Safety and emergencies', de: 'Sicherheit und Notfälle' },
  'Rrugë, ujë dhe qytet': { en: 'Roads, water and city', de: 'Straßen, Wasser und Stadt' },
  'Shërbime për qytetarët': { en: 'Services for citizens', de: 'Dienste für Bürger' },
  'Institucione dhe qeverisje': { en: 'Institutions and government', de: 'Institutionen und Regierung' },
  'Ekonomi dhe punë': { en: 'Economy and work', de: 'Wirtschaft und Arbeit' },
  'Zgjidhni institucionin ose kërkoni problemin (p.sh. rrugë, mbeturina)...': {
    en: 'Choose an institution or search for the problem (e.g. road, waste)...',
    de: 'Institution wählen oder nach dem Problem suchen (z. B. Straße, Müll)...',
  },
  'Kush e merr raportin për ta zgjidhur: komuna, ministria ose kompania. Nëse nuk jeni të sigurt, shkruani problemin në kërkim.': {
    en: 'Who receives the report to resolve it: the municipality, a ministry or a company. If you are not sure, type the problem into the search.',
    de: 'Wer die Meldung zur Lösung erhält: die Gemeinde, ein Ministerium oder ein Unternehmen. Wenn Sie unsicher sind, geben Sie das Problem in die Suche ein.',
  },
  'Në rrezik të menjëhershëm për jetën? Telefononi 112; ky formular nuk zëvendëson emergjencën.': {
    en: 'Immediate danger to life? Call 112; this form does not replace emergency services.',
    de: 'Akute Lebensgefahr? Rufen Sie 112 an; dieses Formular ersetzt keinen Notruf.',
  },

  // ---- /raporto: location --------------------------------------------------
  'Vendndodhja e problemit': { en: 'Location of the problem', de: 'Ort des Problems' },
  'Zgjidhni komunën': { en: 'Choose the municipality', de: 'Gemeinde wählen' },
  'Komuna u ndryshua, por pina mbeti aty ku e vendosët. Kontrolloni që komuna dhe pina përputhen.': {
    en: 'The municipality changed, but the pin stayed where you placed it. Check that the municipality and the pin match.',
    de: 'Die Gemeinde wurde geändert, die Markierung blieb aber dort, wo Sie sie gesetzt haben. Prüfen Sie, ob Gemeinde und Markierung übereinstimmen.',
  },
  'Klikoni në hartë për të vendosur pinën te problemi, ose përdorni GPS, ose shkruani adresën më poshtë.': {
    en: 'Click on the map to place the pin at the problem, or use GPS, or type the address below.',
    de: 'Klicken Sie auf die Karte, um die Markierung am Problem zu setzen, oder nutzen Sie GPS oder geben Sie unten die Adresse ein.',
  },
  'Shfletuesi juaj nuk suporton GPS. Klikoni në hartë ose shkruani adresën.': {
    en: 'Your browser does not support GPS. Click on the map or type the address.',
    de: 'Ihr Browser unterstützt kein GPS. Klicken Sie auf die Karte oder geben Sie die Adresse ein.',
  },
  'Pozicioni u gjet, por adresa jo. Shkruani adresën ose përshkrimin e vendit.': {
    en: 'The position was found but the address was not. Type the address or describe the place.',
    de: 'Die Position wurde gefunden, die Adresse aber nicht. Geben Sie die Adresse ein oder beschreiben Sie den Ort.',
  },
  'Qasja në vendndodhje u refuzua. Lejojeni te cilësimet e shfletuesit, ose klikoni në hartë dhe shkruani adresën.': {
    en: 'Location access was denied. Allow it in your browser settings, or click on the map and type the address.',
    de: 'Der Standortzugriff wurde verweigert. Erlauben Sie ihn in den Browsereinstellungen oder klicken Sie auf die Karte und geben Sie die Adresse ein.',
  },
  'Gjetja e vendndodhjes zgjati shumë. Provoni përsëri ose klikoni në hartë.': {
    en: 'Finding your location took too long. Try again or click on the map.',
    de: 'Die Standortbestimmung hat zu lange gedauert. Versuchen Sie es erneut oder klicken Sie auf die Karte.',
  },
  'Vendndodhja nuk mund të gjendet. Klikoni në hartë ose shkruani adresën.': {
    en: 'Your location cannot be found. Click on the map or type the address.',
    de: 'Ihr Standort kann nicht ermittelt werden. Klicken Sie auf die Karte oder geben Sie die Adresse ein.',
  },
  'Harta tregon qendrën e Prishtinës si pikë fillestare. Nuk është ende vendndodhja e problemit.': {
    en: 'The map shows the centre of Prishtina as a starting point. It is not yet the location of the problem.',
    de: 'Die Karte zeigt als Ausgangspunkt das Zentrum von Pristina. Das ist noch nicht der Ort des Problems.',
  },
  'Harta është në qendër të komunës së zgjedhur. Klikoni në hartë ose shkruani adresën për të shënuar vendin e saktë.': {
    en: 'The map is centred on the chosen municipality. Click on the map or type the address to mark the exact place.',
    de: 'Die Karte ist auf die gewählte Gemeinde zentriert. Klicken Sie auf die Karte oder geben Sie die Adresse ein, um den genauen Ort zu markieren.',
  },
  'Vendndodhja u shënua nga ju në hartë.': { en: 'You marked the location on the map.', de: 'Sie haben den Ort auf der Karte markiert.' },
  'Vendndodhja u zbulua nga GPS. Kontrolloni që pina është te problemi, jo te vendi ku gjendeni.': {
    en: 'The location was detected by GPS. Check that the pin is at the problem, not where you are standing.',
    de: 'Der Ort wurde per GPS ermittelt. Prüfen Sie, ob die Markierung am Problem liegt und nicht dort, wo Sie stehen.',
  },
  'Vendndodhja u zgjodh nga adresa e kërkuar.': { en: 'The location was chosen from the searched address.', de: 'Der Ort wurde aus der gesuchten Adresse übernommen.' },
  'Hartë për shënimin e vendndodhjes. Nëse nuk mund ta përdorni, shkruani adresën në fushën më poshtë.': {
    en: 'Map for marking the location. If you cannot use it, type the address in the field below.',
    de: 'Karte zum Markieren des Ortes. Wenn Sie sie nicht nutzen können, geben Sie die Adresse im Feld darunter ein.',
  },
  'Pina u vendos, por adresa nuk u gjet. Shkruani adresën ose përshkrimin e vendit.': {
    en: 'The pin was placed but the address was not found. Type the address or describe the place.',
    de: 'Die Markierung wurde gesetzt, die Adresse aber nicht gefunden. Geben Sie die Adresse ein oder beschreiben Sie den Ort.',
  },
  'Adresa ose pika e referencës': { en: 'Address or reference point', de: 'Adresse oder Bezugspunkt' },
  'Sugjerime adresash': { en: 'Address suggestions', de: 'Adressvorschläge' },
  'Kjo fushë është alternativa e hartës: shkruani rrugën, lagjen ose një objekt pranë.': {
    en: 'This field is the alternative to the map: type the street, the neighbourhood or a nearby landmark.',
    de: 'Dieses Feld ist die Alternative zur Karte: Geben Sie Straße, Viertel oder ein Objekt in der Nähe ein.',
  },
  'Shënoni vendin e saktë të problemit: klikoni në hartë, përdorni GPS ose shkruani adresën.': {
    en: 'Mark the exact place of the problem: click on the map, use GPS or type the address.',
    de: 'Markieren Sie den genauen Ort des Problems: Klicken Sie auf die Karte, nutzen Sie GPS oder geben Sie die Adresse ein.',
  },

  // ---- /raporto: identity, review, submit -----------------------------------
  'Format: +383 44 123 456': { en: 'Format: +383 44 123 456', de: 'Format: +383 44 123 456' },
  'Në raport shfaqet “Qytetar Anonim” në vend të emrit tuaj.': {
    en: 'The report shows “Anonymous citizen” instead of your name.',
    de: 'In der Meldung erscheint „Anonymer Bürger“ statt Ihres Namens.',
  },
  'Analiza e fotos nuk mundi ta konfirmojë dëshminë': {
    en: 'The photo analysis could not confirm the evidence',
    de: 'Die Fotoanalyse konnte den Nachweis nicht bestätigen',
  },
  'Kjo mund të ndodhë me foto të errëta, të paqarta ose pamje ekrani. Nuk e bllokon raportin: stafi e shqyrton çdo raport para publikimit dhe do ta shohë këtë shënim.': {
    en: 'This can happen with dark or unclear photos or screenshots. It does not block the report: staff review every report before publication and will see this note.',
    de: 'Das kann bei dunklen oder unscharfen Fotos oder Screenshots passieren. Es blockiert die Meldung nicht: Das Personal prüft jede Meldung vor der Veröffentlichung und sieht diesen Hinweis.',
  },
  'Ndrysho dëshminë': { en: 'Change the evidence', de: 'Nachweis ändern' },
  'Dërgo gjithsesi për shqyrtim': { en: 'Send anyway for review', de: 'Trotzdem zur Prüfung senden' },
  'Dërgo raportin': { en: 'Send the report', de: 'Meldung senden' },
  'Pas dërgimit merrni një Track-ID. Raporti shqyrtohet nga stafi para se të bëhet publik.': {
    en: 'After sending you receive a Track-ID. Staff review the report before it becomes public.',
    de: 'Nach dem Senden erhalten Sie eine Track-ID. Das Personal prüft die Meldung, bevor sie öffentlich wird.',
  },
  'Për të ruajtur raportin nevojitet një sesion aktiv. Kyçuni ose vazhdoni si mysafir dhe provoni përsëri — të dhënat e formës ruhen.': {
    en: 'An active session is needed to save the report. Sign in or continue as a guest and try again; the form data is kept.',
    de: 'Zum Speichern der Meldung ist eine aktive Sitzung nötig. Melden Sie sich an oder fahren Sie als Gast fort und versuchen Sie es erneut; die Formulardaten bleiben erhalten.',
  },
  'Teksti i raportit nuk u pranua. Rishikoni formulimin.': {
    en: 'The report text was not accepted. Please review the wording.',
    de: 'Der Text der Meldung wurde nicht akzeptiert. Bitte überprüfen Sie die Formulierung.',
  },
  '{count} nga {total} dëshmi nuk u ngarkuan. Provoni përsëri ose hiqini nga lista; raporti nuk është dërguar.': {
    en: '{count} of {total} evidence files were not uploaded. Try again or remove them from the list; the report has not been sent.',
    de: '{count} von {total} Nachweisen wurden nicht hochgeladen. Versuchen Sie es erneut oder entfernen Sie sie aus der Liste; die Meldung wurde nicht gesendet.',
  },
  'Një raport i ngjashëm u dërgua së fundmi nga ju. Prisni disa minuta para se ta dërgoni përsëri.': {
    en: 'A similar report was sent by you recently. Wait a few minutes before sending it again.',
    de: 'Sie haben kürzlich eine ähnliche Meldung gesendet. Warten Sie einige Minuten, bevor Sie sie erneut senden.',
  },
  'Keni dërguar shumë raporte në pak minuta. Provoni përsëri pak më vonë.': {
    en: 'You have sent many reports in a few minutes. Try again a little later.',
    de: 'Sie haben in wenigen Minuten viele Meldungen gesendet. Versuchen Sie es etwas später erneut.',
  },
  'Raportimi u refuzua nga serveri.': { en: 'The server refused the report.', de: 'Der Server hat die Meldung abgelehnt.' },
  'Serveri nuk e pranoi raportin. Kontrolloni fushat dhe provoni përsëri.': {
    en: 'The server did not accept the report. Check the fields and try again.',
    de: 'Der Server hat die Meldung nicht akzeptiert. Prüfen Sie die Felder und versuchen Sie es erneut.',
  },
  'Sesioni juaj ka skaduar. Rifreskoni faqen ose kyçuni përsëri; teksti i raportit ruhet në këtë skedë, por dëshmitë duhen shtuar sërish.': {
    en: 'Your session has expired. Refresh the page or sign in again; the report text is kept in this tab, but evidence must be added again.',
    de: 'Ihre Sitzung ist abgelaufen. Laden Sie die Seite neu oder melden Sie sich erneut an; der Text der Meldung bleibt in diesem Tab erhalten, Nachweise müssen aber erneut hinzugefügt werden.',
  },
  'Serveri po përgjigjet ngadalë. Raporti mund të jetë ruajtur. Provoni përsëri: nuk do të krijohet dublikat.': {
    en: 'The server is responding slowly. The report may already be saved. Try again: no duplicate will be created.',
    de: 'Der Server antwortet langsam. Die Meldung ist möglicherweise bereits gespeichert. Versuchen Sie es erneut: Es wird kein Duplikat erstellt.',
  },
  'Raporti nuk u ruajt. Provoni përsëri: nuk do të krijohet dublikat.': {
    en: 'The report was not saved. Try again: no duplicate will be created.',
    de: 'Die Meldung wurde nicht gespeichert. Versuchen Sie es erneut: Es wird kein Duplikat erstellt.',
  },
  'Raporti NUK u dërgua dhe nuk u krijua Track ID. Të dhënat e formës janë ende këtu — kontrolloni lidhjen dhe provoni përsëri.': {
    en: 'The report was NOT sent and no Track ID was created. Your form data is still here; check your connection and try again.',
    de: 'Die Meldung wurde NICHT gesendet und es wurde keine Track-ID erstellt. Ihre Formulardaten sind noch da; prüfen Sie die Verbindung und versuchen Sie es erneut.',
  },
  'Ka ndodhur një gabim gjatë procesimit të të dhënave, provoni përsëri.': {
    en: 'An error occurred while processing the data. Please try again.',
    de: 'Bei der Verarbeitung der Daten ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
  },
  'Ruajeni Track-ID: është mënyra e vetme për ta ndjekur raportin pa llogari. Platforma nuk dërgon email konfirmimi.': {
    en: 'Keep the Track-ID: it is the only way to follow the report without an account. The platform does not send a confirmation email.',
    de: 'Bewahren Sie die Track-ID auf: Sie ist die einzige Möglichkeit, die Meldung ohne Konto zu verfolgen. Die Plattform sendet keine Bestätigungs-E-Mail.',
  },

  // ---- first visit: age gate ----
  'Shkruani moshën tuaj si numër të plotë.': {
    en: 'Enter your age as a whole number.',
    de: 'Geben Sie Ihr Alter als ganze Zahl ein.',
  },
  'Para vazhdimit': {
    en: 'Before you continue',
    de: 'Bevor Sie fortfahren',
  },
  'Mosha juaj': {
    en: 'Your age',
    de: 'Ihr Alter',
  },
  'p.sh. 17': {
    en: 'e.g. 17',
    de: 'z. B. 17',
  },
  'Për verifikim ruhet vetëm shenja se mosha minimale është plotësuar; mosha që shkruani nuk regjistrohet.': {
    en: 'Only a mark that the minimum age is met is stored for verification; the age you type is not recorded.',
    de: 'Zur Überprüfung wird nur vermerkt, dass das Mindestalter erfüllt ist; das eingegebene Alter wird nicht gespeichert.',
  },
};
