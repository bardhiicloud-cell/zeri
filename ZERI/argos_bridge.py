"""
Bridge translator driven by the Node generator.

Reads one JSON request per line on stdin and writes one JSON response per line
on stdout, so a Node process can keep the models warm across thousands of
strings instead of paying model-load cost per batch.

All Argos chatter goes to stderr: the library prints model-load warnings on
stdout by default, and a single warning line corrupts the JSON stream and hangs
the parent. stdout is reserved for the protocol and nothing else.

Request :  {"lang": "fr", "texts": ["...", "..."]}
Response:  {"lang": "fr", "results": {"<source>": "<translation|null>"}}
"""
import io
import json
import sys
import warnings

# Windows consoles default to a legacy code page, so both pipes are forced to
# UTF-8 before anything else touches them. PYTHONUTF8=1 is also set by the Node
# parent; this covers the case where the bridge is run by hand.
if hasattr(sys.stdout, 'buffer'):
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Silence the library before importing it: its warnings would otherwise be
# emitted on stdout and corrupt the JSON protocol.
warnings.showwarning = lambda *a, **k: None
import logging
logging.disable(logging.CRITICAL)

import argostranslate.translate as translate

# Swiss German has no model; standard German is what a Swiss reader reads.
ALIAS = {'gsw': 'de'}

_cache = {}


def chain_translate(text, target):
    """Albanian to `target` via English, Argos's hub language."""
    resolved = ALIAS.get(target, target)
    try:
        step1 = translate.translate(text, 'sq', 'en')
        if resolved == 'en':
            return step1
        return translate.translate(step1, 'en', resolved)
    except Exception as e:
        sys.stderr.write(f'translate error for {target}: {e}\n')
        return None


def handle(req):
    lang = req.get('lang')
    texts = req.get('texts') or []
    results = {}
    for text in texts:
        key = (lang, text)
        if key in _cache:
            results[text] = _cache[key]
            continue
        out = chain_translate(text, lang)
        # An empty or unchanged result is a miss, not a translation: record null
        # so the caller retries later instead of persisting the source text.
        if out and out.strip() and out.strip() != text.strip():
            _cache[key] = out
            results[text] = out
        else:
            results[text] = None
    return {'lang': lang, 'results': results}


def main():
    # One response per request line; models stay loaded between requests.
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            resp = handle(req)
        except Exception as e:
            resp = {'error': str(e)}
        sys.stdout.write(json.dumps(resp, ensure_ascii=False) + '\n')
        sys.stdout.flush()


if __name__ == '__main__':
    main()
