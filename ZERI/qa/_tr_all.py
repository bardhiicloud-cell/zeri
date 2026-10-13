import json, re, sys
import argostranslate.translate as t

LANGS = ['ar', 'bg', 'fr', 'it', 'ja', 'ko', 'nb', 'nl', 'pl', 'pt', 'sl', 'sv', 'tr']
p = 'src/lib/publicPagesTranslations.ts'
src = open(p, encoding='utf8').read()
head = src[:src.index('export const publicPagesTranslations')]
rows = re.findall(r'^  (".*?"): \{ en: (".*?"), de: (".*?") \},$', src, re.M)
installed = {l.code: l for l in t.get_installed_languages()}
en = installed['en']
tr = {c: en.get_translation(installed[c]) for c in LANGS}
out = []
for i, (sq, e, d) in enumerate(rows):
    en_text = json.loads(e)
    entry = {'en': en_text, 'de': json.loads(d), 'gsw': json.loads(d)}
    for c in LANGS:
        try:
            entry[c] = tr[c].translate(en_text)
        except Exception:
            pass
    out.append("  %s: %s," % (sq, json.dumps(entry, ensure_ascii=False)))
    if i % 20 == 0:
        print(i, flush=True)
body = head + "export const publicPagesTranslations: Record<string, Record<string, string>> = {\n" + "\n".join(out) + "\n};\n"
open(p, 'w', encoding='utf8').write(body)
print('done', len(out))
