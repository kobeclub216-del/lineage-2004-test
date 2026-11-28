@echo off
setlocal
set "MAP_TOOL_DIR=%~dp0"
powershell.exe -NoProfile -STA -Command "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Windows.Forms; $src=New-Object Windows.Forms.FolderBrowserDialog; $src.Description='Select client folder with loose map assets'; if($src.ShowDialog() -ne 'OK'){exit 1}; $out=New-Object Windows.Forms.SaveFileDialog; $out.Filter='ZIP archive|*.zip'; $out.FileName='Lineage-local-maps.zip'; if($out.ShowDialog() -ne 'OK'){exit 1}; & py.exe -3 (Join-Path $env:MAP_TOOL_DIR 'bundle-local-maps.py') $src.SelectedPath $out.FileName; exit $LASTEXITCODE"
echo Exit code: %errorlevel%
pause
