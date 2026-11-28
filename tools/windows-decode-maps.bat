@echo off
setlocal
set "MAP_DECODE_DIR=%~dp0"
powershell.exe -NoProfile -STA -Command "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Windows.Forms; $zip=New-Object Windows.Forms.OpenFileDialog; $zip.Filter='Map bundle ZIP|*.zip'; $zip.Title='Select local maps ZIP, or Cancel to select an unpacked folder'; if($zip.ShowDialog() -eq 'OK'){$src=$zip.FileName}else{$folder=New-Object Windows.Forms.FolderBrowserDialog; $folder.Description='Select folder containing local-map-bundle.json'; if($folder.ShowDialog() -ne 'OK'){exit 1}; $src=$folder.SelectedPath}; $viewer=New-Object Windows.Forms.OpenFileDialog; $viewer.Filter='Executable|*.exe'; $viewer.Title='Select L1MapViewer executable'; if($viewer.ShowDialog() -ne 'OK'){exit 1}; $out=Join-Path ([Environment]::GetFolderPath('Desktop')) ('Lineage-decoded-maps-'+[Guid]::NewGuid().ToString('N').Substring(0,8)); & py.exe -3 (Join-Path $env:MAP_DECODE_DIR 'decode-local-maps.py') $src $out --viewer $viewer.FileName; $code=$LASTEXITCODE; if(Test-Path -LiteralPath $out){Invoke-Item -LiteralPath $out}; exit $code"
echo Exit code: %errorlevel%
pause
