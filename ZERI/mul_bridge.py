"""
Multilingual bridge for the languages Argos does not publish.

Argos covers most of our targets but has no model at all for Bosnian, Serbian,
Croatian or Macedonian. Helsinki-NLP's `opus-mt-en-mul` covers exactly those
four.

CRITICAL: this model is English-source only. Feeding it Albanian makes it return
the Albanian almost unchanged ("ndiqni zgjidhjet" -> "dhendiqni zgjidhjet"),
which is worse than no translation because it looks like it worked. The caller
must therefore send ENGLISH. The Node side runs Albanian through Argos sq->en
first and passes the result here.

Why a separate process rather than one bridge: Argos and transformers have
incompatible dependency ranges, and importing both into one interpreter broke the
Argos import. Two processes each load only what they need.

Request :  {"lang": "hr", "texts": ["<english>", "..."]}
Response:  {"lang": "hr", "results": {"<english source>": "<translation|null>"}}
"""
import io
import json
import sys
import warnings

if hasattr(sys.stdout, 'buffer'):
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

warnings.showwarning = lambda *a, **k: None
import logging
logging.disable(logging.CRITICAL)

# opus-mt-en-mul is many-to-many: the target is selected by prefixing the source
# text with a language tag. These tags were not guessed — every plausible
# spelling was tested and the ones below are the only ones that produced real
# output. Bare "bs"/"hr"/"sr"/"hbs" return mangled text ("Rapportaring"), which
# is why the first Bosnian run reported +0 filled.
TARGET_TAG = {
    'bs': 'bos_Latn',
    'sr': 'srp_Cyrl',
    'hr': 'hrv',
    'mk': 'mkd',
}

MODEL = 'Helsinki-NLP/opus-mt-en-mul'

_tokenizer = None
_model = None


def _load():
    global _tokenizer, _model
    if _model is not None:
        return
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    _tokenizer = AutoTokenizer.from_pretrained(MODEL)
    _model = AutoModelForSeq2SeqLM.from_pretrained(MODEL)
    _model.eval()


def translate_batch(texts, tag):
    import torch
    _load()
    tagged = [f'>>{tag}<< {t}' for t in texts]
    with torch.no_grad():
        encoded = _tokenizer(tagged, return_tensors='pt', padding=True, truncation=True, max_length=512)
        generated = _model.generate(**encoded, max_length=512, num_beams=2)
    return _tokenizer.batch_decode(generated, skip_special_tokens=True)


def handle(req):
    lang = req.get('lang')
    texts = req.get('texts') or []
    tag = TARGET_TAG.get(lang)
    if not tag:
        return {'error': f'no multilingual mapping for {lang}'}

    try:
        outputs = translate_batch(texts, tag)
        results = {}
        for src, out in zip(texts, outputs):
            text = (out or '').strip()
            # The model emits UTF-8 that arrives as mojibake when the bytes are
            # decoded as Latin-1 downstream, so the reversal happens here where
            # the original encoding is known.
            text = _fix_mojibake(text)
            results[src] = text if text and text != src else None
        return {'lang': lang, 'results': results}
    except Exception as e:
        sys.stderr.write(f'mul error: {e}\n')
        return {'lang': lang, 'results': {s: None for s in texts}}


def _fix_mojibake(text):
    """Undo the Latin-1/UTF-8 double decode, e.g. "rjeÅ¡enja" -> "rješenja"."""
    if 'Ã' not in text and 'Â' not in text and 'Å' not in text:
        return text
    try:
        return text.encode('latin1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            resp = handle(json.loads(line))
        except Exception as e:
            resp = {'error': str(e)}
        sys.stdout.write(json.dumps(resp, ensure_ascii=False) + '\n')
        sys.stdout.flush()


if __name__ == '__main__':
    main()
