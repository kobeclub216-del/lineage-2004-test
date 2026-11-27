$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

function Select-File($Title, $Filter) {
 $dialog = New-Object System.Windows.Forms.OpenFileDialog
 try {
  $dialog.Title = $Title
  $dialog.Filter = $Filter
  if ($dialog.ShowDialog() -eq 'OK') { return $dialog.FileName }
 } finally { $dialog.Dispose() }
}

$cli = Select-File 'Select PakViewer CLI' 'Executable (*.exe)|*.exe'
if (!$cli) { exit 1 }
$folder = New-Object System.Windows.Forms.FolderBrowserDialog
$folder.Description = 'Select the Lineage client folder'
try {
 if ($folder.ShowDialog() -ne 'OK') { exit 1 }
 $client = $folder.SelectedPath
} finally { $folder.Dispose() }

$list = Select-File 'Select list.spr exported from this client' 'SPR definitions (*.spr;*.txt)|*.spr;*.txt'
if (!$list) { exit 1 }
$launcher = Get-Command py.exe -ErrorAction SilentlyContinue
if (!$launcher) { throw 'Python 3 and its Windows py launcher are required.' }

$listHash = (Get-FileHash -LiteralPath $list -Algorithm SHA256).Hash
$sha = [Security.Cryptography.SHA256]::Create()
try {
 $identity = [Text.Encoding]::UTF8.GetBytes($client.ToUpperInvariant() + '|' + $listHash)
 $key = [BitConverter]::ToString($sha.ComputeHash($identity)).Replace('-', '').Substring(0,16)
} finally { $sha.Dispose() }
$output = Join-Path ([Environment]::GetFolderPath('Desktop')) ('Lineage-sprite-batch-' + $key)
$arguments = @($list, $output)
$catalog = Join-Path (Split-Path -Parent $list) 'sprite-batch-catalog.json'
if (Test-Path -LiteralPath $catalog -PathType Leaf) { $arguments += @('--catalog', $catalog) }
& $launcher.Source -3 (Join-Path $PSScriptRoot 'plan-sprite-batch.py') @arguments
$code = $LASTEXITCODE
if ($code -eq 0) {
 & (Join-Path $PSScriptRoot 'windows-export-character.ps1') -Cli $cli -Client $client `
  -Names (Join-Path $output 'names.txt') -Output (Join-Path $output 'frames')
 $code = $LASTEXITCODE
}
if (Test-Path -LiteralPath $output) { Invoke-Item -LiteralPath $output }
exit $code
