# Scans the source tree for light-only utility classes that have no `dark:`
# counterpart on the same element. Those are the elements that keep a white
# surface, near-black text or a pale border while the app is in night mode.
#
# Usage:  powershell -File tools/scan-darkmode.ps1
$patterns = @(
  'bg-white(?![/a-zA-Z0-9_-])',
  'bg-slate-50(?![/a-zA-Z0-9_-])',
  'bg-slate-100(?![/a-zA-Z0-9_-])',
  'text-slate-(800|900|950)(?![/a-zA-Z0-9_-])',
  'border-slate-(100|200|300)(?![/a-zA-Z0-9_-])',
  'divide-slate-(100|200)(?![/a-zA-Z0-9_-])'
)

$files = Get-ChildItem -Path src -Recurse -Include *.tsx,*.ts -File
$hits = @()

foreach ($f in $files) {
  $lines = Get-Content -LiteralPath $f.FullName
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -match 'dark:') { continue }
    foreach ($p in $patterns) {
      if ($line -match $p) {
        $hits += [pscustomobject]@{
          File  = $f.FullName.Replace((Get-Location).Path + '\', '')
          Line  = $i + 1
          Rule  = $p
          Text  = $line.Trim()
        }
        break
      }
    }
  }
}

$hits | Group-Object File | Sort-Object Count -Descending | Select-Object Count, Name | Format-Table -AutoSize | Out-String -Width 160
"TOTAL: $($hits.Count)"
