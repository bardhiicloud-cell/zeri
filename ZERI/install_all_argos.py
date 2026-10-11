"""
Install every Argos model the project can use, including the ones missed on the
first pass.

The first run asked only for the 14 added languages and silently skipped anything
not in the index. This version asks for the complete set we can actually serve,
adds Turkish (which IS published, as en->tr, and is needed because Turkish is one
of the original six that still has gaps), and reports precisely which pairs are
unavailable so the coverage number is honest.
"""
import argostranslate.package as pkg

# Every language the app supports, except Albanian itself.
WANTED = ['en', 'de', 'bs', 'ar', 'tr', 'sr', 'fr', 'it', 'es', 'pt',
          'gsw', 'mk', 'sl', 'hr', 'ro', 'sv', 'nb', 'hy', 'nl']

# Swiss German rides on standard German; Argos has no gsw model.
ALIAS = {'gsw': 'de'}

# English can reach these (from the index listing); bs, sr, mk, hr, hy are not.
available = pkg.get_available_packages()
index = {(p.from_code, p.to_code): p for p in available}
installed = {(p.from_code, p.to_code) for p in pkg.get_installed_packages()}

print('Ensuring sq->en first...')
if ('sq', 'en') not in installed:
    p = index.get(('sq', 'en'))
    if p:
        pkg.install_from_path(p.download())
        installed.add(('sq', 'en'))
        print('  installed sq->en')
    else:
        print('  sq->en MISSING from index')
else:
    print('  sq->en already present')

print('\nInstalling en->target for each language:')
unavailable = []
for lang in WANTED:
    resolved = ALIAS.get(lang, lang)
    pair = ('en', resolved)
    if pair in installed:
        print(f'  {lang:<5} (via {resolved}) already installed')
        continue
    p = index.get(pair)
    if p is None:
        print(f'  {lang:<5} (via {resolved}) NOT PUBLISHED by Argos')
        unavailable.append(lang)
        continue
    print(f'  {lang:<5} (via {resolved}) downloading...', end=' ', flush=True)
    try:
        pkg.install_from_path(p.download())
        installed.add(pair)
        print('ok')
    except Exception as e:
        print(f'FAILED {e}')
        unavailable.append(lang)

print('\n--- SUMMARY ---')
print('Served offline by Argos:', ', '.join(l for l in WANTED if l not in unavailable))
print('Not available offline   :', ', '.join(unavailable) if unavailable else '(none)')