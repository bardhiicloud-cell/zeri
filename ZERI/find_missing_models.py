"""
Find models for Macedonian and Croatian under any of the code spellings Argos
uses, then install whichever exists.

These two were reported NOT AVAILABLE under their plain ISO codes, but Argos
does not always index a language under the code we use internally — Norwegian is
listed as "no" while we call it "nb", and a language may also be listed only as
a source of a model rather than a target. This scans the whole index rather than
guessing. (Bulgarian, a target in its own right, is indexed as plain "bg".)
"""
import argostranslate.package as pkg

# Every code spelling that might refer to each missing language.
WANTED = {
    'mk': ['mk', 'mkd', 'mac', 'mk_MK'],              # Macedonian
    'hr': ['hr', 'hrv', 'sr', 'bs', 'sh'],            # Croatian; close South-Slavic fallbacks
}

# Codes we will NOT accept even as a fallback, because the result would be the
# wrong language rather than a close one (bg is Bulgarian, a different language).
BLOCKED = {'bg', 'sr', 'bs', 'sh'}

available = pkg.get_available_packages()
installed = {(p.from_code, p.to_code) for p in pkg.get_installed_packages()}

print(f"Index has {len(available)} packages.\n")

# What can English reach at all?
en_targets = sorted({p.to_code for p in available if p.from_code == 'en'})
print("English can reach:", ', '.join(en_targets))
print()

# Does anything reach our missing languages, from anywhere?
for lang, codes in WANTED.items():
    print(f"Looking for '{lang}' (codes tried: {', '.join(codes)}):")
    found_any = False
    for p in available:
        if p.to_code in codes or p.from_code in codes:
            ok = p.to_code not in BLOCKED and p.from_code not in BLOCKED
            flag = 'candidate' if ok else 'blocked (different language)'
            print(f"    {p.from_code} -> {p.to_code}  [{p.package_version}]  {flag}")
            found_any = True
    if not found_any:
        print("    nothing in the index touches this language at all")
    print()

print("Installed so far:")
for src, dst in sorted(installed):
    print(f"  {src} -> {dst}")
