"""
Install the Argos Translate models needed to translate Albanian into all 14
added languages.

Argos publishes models as directed pairs. Albanian only has sq<->en, so every
target is reached through English: sq -> en -> <target>. That is a pivot
translation and it loses a little nuance versus a direct model, but it is the
only route that exists offline, and it is far better than shipping Albanian text
on a German page.

Idempotent: already-installed packages are skipped, so re-running is safe and
resumes an interrupted download.
"""
import sys

import argostranslate.package as pkg
import argostranslate.translate as translate

# Targets we need, in the internal codes the app uses.
TARGETS = ['ar', 'fr', 'it', 'es', 'pt', 'de', 'mk', 'sl', 'hr', 'ro', 'sv', 'nb', 'hy', 'nl']

# Swiss German has no Argos model; standard German is the closest available and
# is what a Swiss reader can read, so gsw is served by the de pivot.
PIVOT_FOR = {'gsw': 'de'}

# Argos names Norwegian "nb"; Armenian is "hy". Both match our codes already.
REQUIRED = ['sq->en'] + [f"en->{PIVOT_FOR.get(t, t)}" for t in TARGETS]


def installed_pairs():
    return {(p.from_code, p.to_code) for p in pkg.get_installed_packages()}


def main():
    available = pkg.get_available_packages()
    index = {(p.from_code, p.to_code): p for p in available}
    have = installed_pairs()

    for pair in REQUIRED:
        src, dst = pair.split('->')
        if (src, dst) in have:
            print(f"  {pair:<12} already installed")
            continue

        p = index.get((src, dst))
        if p is None:
            print(f"  {pair:<12} NOT AVAILABLE in the Argos index")
            continue

        print(f"  {pair:<12} downloading {p.package_version} ...", end=' ', flush=True)
        try:
            pkg.install_from_path(p.download())
            print("ok")
        except Exception as e:
            print(f"FAILED: {e}")

    print("\nInstalled pairs:")
    for src, dst in sorted(installed_pairs()):
        print(f"  {src} -> {dst}")

    # Smoke test the full chain.
    print("\nSmoke test (sq -> chain):")
    for target in ['fr', 'de', 'nl']:
        try:
            step1 = translate.translate('Mirësevini në platformë', 'sq', 'en')
            out = translate.translate(step1, 'en', target)
            print(f"  {target}: {out}")
        except Exception as e:
            print(f"  {target}: FAILED {e}")


if __name__ == '__main__':
    sys.exit(main())
