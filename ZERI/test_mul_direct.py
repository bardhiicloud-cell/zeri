"""Direct test of the corrected mul bridge for Bosnian and Croatian."""
import io
import json
import subprocess
import sys

proc = subprocess.Popen(
    [sys.executable, 'mul_bridge.py'],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    encoding='utf-8',
)

for lang in ['bs', 'hr']:
    req = json.dumps({
        'lang': lang,
        'texts': [
            'Raportoni problemet dhe ndiqni zgjidhjet',
            'Mirësevini në platformën qendrore',
            'Komuna e Prishtinës',
        ],
    })
    proc.stdin.write(req + '\n')
    proc.stdin.flush()
    line = proc.stdout.readline()
    data = json.loads(line)
    print(f'--- {lang} ---')
    for src, out in data.get('results', {}).items():
        print(f'  {src!r}')
        print(f'    -> {out!r}')

proc.stdin.close()
proc.wait(timeout=10)