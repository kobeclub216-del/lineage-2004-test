@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Windows.Forms; function PickFile($title,$filter){$d=New-Object Windows.Forms.OpenFileDialog; $d.Title=$title; $d.Filter=$filter; if($d.ShowDialog() -ne 'OK'){throw 'Cancelled'}; $d.FileName}; $cli=PickFile 'Select PakViewer CLI' 'Executable (*.exe)|*.exe'; $d=New-Object Windows.Forms.FolderBrowserDialog; $d.Description='Select Lineage client folder'; if($d.ShowDialog() -ne 'OK'){exit 1}; $client=$d.SelectedPath; $names=PickFile 'Select validated names.txt export queue' 'Text (*.txt)|*.txt'; $out=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Lineage-character-export'; & '%~dp0windows-export-character.ps1' -Cli $cli -Client $client -Names $names -Output $out; if($LASTEXITCODE){exit $LASTEXITCODE}"
echo Exit code: %errorlevel%
pause
