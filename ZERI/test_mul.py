"""Standalone smoke test for the multilingual model."""
import sys
sys.path.insert(0, '.')
from mul_bridge import get_pipe

print('loading model...', flush=True)
pipe = get_pipe()
print('loaded.', flush=True)

samples = [
    '>>hrv<< Report the problems and follow the solutions',
    '>>mkd<< Welcome to the central platform',
    '>>hye<< Citizen of Kosovo',
    '>>srp_Cyrl<< The municipality of Pristina',
    '>>bos_Latn<< Public services for citizens',
]

for out in pipe(samples, max_length=256):
    print(repr(out['translation_text']), flush=True)
