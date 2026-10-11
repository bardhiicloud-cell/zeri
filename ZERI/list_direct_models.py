"""
Check whether direct Albanian -> target models exist for any of our languages.

The pivot through English (sq -> en -> X) is what produces stiff output like
"Probleme melden und Lösungen folgen" for "Raportoni problemet dhe ndiqni
zgjidhjet". A direct model, where one exists, is markedly better. This lists
every published package with Albanian as the source so we know exactly what is
available rather than assuming only sq<->en exists.
"""
import argostranslate.package as pkg

available = pkg.get_available_packages()

from_sq = [p for p in available if p.from_code == 'sq']
to_sq = [p for p in available if p.to_code == 'sq']

print(f"Packages FROM Albanian ({len(from_sq)}):")
for p in sorted(from_sq, key=lambda x: x.to_code):
    print(f"  sq -> {p.to_code}   v{p.package_version}")

print(f"\nPackages INTO Albanian ({len(to_sq)}):")
for p in sorted(to_sq, key=lambda x: x.from_code):
    print(f"  {p.from_code} -> sq   v{p.package_version}")

# Also show which languages English can reach, for the pivot route.
en_out = sorted({p.to_code for p in available if p.from_code == 'en'})
print(f"\nEnglish can reach {len(en_out)} languages:")
print(' ', ', '.join(en_out))