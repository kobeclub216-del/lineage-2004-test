param(
 [Parameter(Mandatory=$true)][string]$Cli,
 [Parameter(Mandatory=$true)][string]$Client,
 [Parameter(Mandatory=$true)][string]$Names,
 [Parameter(Mandatory=$true)][string]$Output
)
$ErrorActionPreference = 'Stop'
$Cli = (Resolve-Path -LiteralPath $Cli).Path
$Client = (Resolve-Path -LiteralPath $Client).Path
$queue = @(Get-Content -LiteralPath $Names | ForEach-Object {$_.Trim()} | Where-Object {$_} | Sort-Object -Unique)
if (!$queue.Count) {throw 'Empty queue'}
foreach ($name in $queue) {if ($name -notmatch '^\d+-\d+\.spr$') {throw "Invalid name: $name"}}
New-Item -ItemType Directory -Force -Path $Output | Out-Null
$Output = (Resolve-Path -LiteralPath $Output).Path
$report = @()
$i = 0
foreach ($name in $queue) {
 $i++
 Write-Host "[$i/$($queue.Count)] $name"
 $dest = Join-Path $Output ([IO.Path]::GetFileNameWithoutExtension($name))
 New-Item -ItemType Directory -Force -Path $dest | Out-Null
 $marker = Join-Path $dest 'complete.txt'
 $info = Join-Path $dest 'info.txt'
 $log = Join-Path $dest 'export.txt'
 $count = @(Get-ChildItem -LiteralPath $dest -Filter '*.png' -File).Count
 $savedCount = if (Test-Path -LiteralPath $marker) { (Get-Content -LiteralPath $marker -Raw).Trim() }
 if (!$count -or $savedCount -ne [string]$count -or !(Test-Path -LiteralPath $info)) {
   Remove-Item -LiteralPath $marker -ErrorAction SilentlyContinue
   Get-ChildItem -LiteralPath $dest -Filter '*.png' -File | Remove-Item
   $ErrorActionPreference = 'Continue'
   & $Cli spr info $Client $name 2>&1 | Out-File -LiteralPath $info -Encoding utf8
   $infoCode = $LASTEXITCODE
   & $Cli spr export $Client $name -o $dest 2>&1 | Out-File -LiteralPath $log -Encoding utf8
   $code = $LASTEXITCODE
   $ErrorActionPreference = 'Stop'
   $count = @(Get-ChildItem -LiteralPath $dest -Filter '*.png' -File).Count
   if ($code -eq 0 -and $infoCode -eq 0 -and $count -gt 0) {Set-Content -LiteralPath $marker -Value $count}
 }
 $report += [pscustomobject]@{name=$name;frames=$count;complete=(Test-Path -LiteralPath $marker)}
 $report | Export-Csv -LiteralPath (Join-Path $Output 'report.csv') -NoTypeInformation -Encoding UTF8
}
if (@($report | Where-Object {!$_.complete}).Count) {exit 1}
