"""
Find the working target tag for Bosnian and Croatian in opus-mt-en-mul.

The model returned the input unchanged for 'bos_Latn', so the tag is wrong for
this checkpoint. Rather than guess, this tries every plausible spelling and
prints what actually comes back, so the mapping is decided by evidence.
"""
import io
import sys
import warnings

if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
warnings.showwarning = lambda *a, **k: None
import logging
logging.disable(logging.CRITICAL)

from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

MODEL = 'Helsinki-NLP/opus-mt-en-mul'
tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL)
model.eval()

# The exact source sentence, so any change proves the tag did something.
SRC = 'Report the problems and follow the solutions'

CANDIDATES = [
    'bos_Latn', 'bos', 'bs', 'hbs', 'hbs_Latn', 'sr_Latn', 'srp_Latn',
    'hrv', 'hr', 'hr_Latn', 'srp_Cyrl', 'sr', 'sh', 'cnr',
]

print(f'Source: {SRC!r}\n')
for tag in CANDIDATES:
    try:
        enc = tok([f'>>{tag}<< {SRC}'], return_tensors='pt', truncation=True, max_length=256)
        with torch.no_grad():
            gen = model.generate(**enc, max_length=256, num_beams=1)
        out = tok.batch_decode(gen, skip_special_tokens=True)[0].strip()
        marker = 'CHANGED' if out != SRC else 'unchanged'
        print(f'  >>{tag}<<  [{marker}]  {out[:70]}')
    except Exception as e:
        print(f'  >>{tag}<<  ERROR {str(e)[:60]}')