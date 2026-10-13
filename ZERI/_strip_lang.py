"""
Remove a language's entries from the uiTranslations table.

The table is written one entry per line (or one multi-line entry) as

    'Source': { en: '...', de: '...', es: '...' },

and Spanish was removed from the supported set. Leaving the columns behind is
not merely cosmetic: `uiTranslations` is typed
`Partial<Record<SupportedLanguageCode, string>>`, so every stale `es:` key is a
compile error rather than dead data.

The strip is deliberately quote-aware instead of a `\bes:` regex. Three of the
sources are Icelandic/Portuguese strings that legitimately contain the letters
"es" inside a quoted value ("... es: ..."), and a naive pattern would cut the
string in half.

Usage:  python _strip_lang.py es [fo] ...
"""
import re
import sys

FILE = r"src\lib\uiTranslations.ts"


def strip_language(text, code):
    out = []
    i = 0
    n = len(text)
    removed = 0

    while i < n:
        ch = text[i]

        if ch == "'":
            # Copy a single-quoted string verbatim, escapes included.
            j = i + 1
            while j < n:
                if text[j] == '\\':
                    j += 2
                    continue
                if text[j] == "'":
                    break
                j += 1
            out.append(text[i:j + 1])
            i = j + 1
            continue

        # A key starts at a word boundary and is followed by `:` then a value.
        if text.startswith(code + ':', i):
            prev = text[i - 1] if i > 0 else ' '
            if not (prev.isalnum() or prev == '_'):
                # Find the end of this value: the next key entry or the object's
                # closing brace at the same nesting level we started at.
                start = i
                j = i + len(code) + 1
                depth = 0
                while j < n:
                    c = text[j]
                    if c == "'":
                        j += 1
                        while j < n:
                            if text[j] == '\\':
                                j += 2
                                continue
                            if text[j] == "'":
                                break
                            j += 1
                    elif c in '[{':
                        depth += 1
                    elif c in ']}':
                        if depth == 0:
                            break
                        depth -= 1
                    elif c == ',' and depth == 0:
                        j += 1
                        break
                    j += 1

                # Drop the value and the whitespace/key-separator before it, plus
                # a trailing comma so the previous entry stays valid.
                k = start
                while k > 0 and text[k - 1] in ' \t':
                    k -= 1
                if k > 0 and text[k - 1] == ',':
                    k -= 1
                tail = text[j:]
                if tail.lstrip().startswith('}') and k > 0 and text[k - 1] != ',':
                    # Last property in the object: no dangling comma allowed.
                    pass
                else:
                    tail = tail.lstrip()
                    if tail.startswith('}'):
                        out.append(',')
                i = j
                removed += 1
                continue

        out.append(ch)
        i += 1

    return ''.join(out), removed


def main():
    codes = sys.argv[1:] or ['es']
    with open(FILE, encoding='utf-8') as fh:
        text = fh.read()

    total = 0
    for code in codes:
        text, removed = strip_language(text, code)
        total += removed
        print(f'{code}: removed {removed} entries')

    with open(FILE, 'w', encoding='utf-8') as fh:
        fh.write(text)
    print(f'total removed: {total}')


if __name__ == '__main__':
    main()
