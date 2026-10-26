@echo off
chcp 65001 >nul
rem Tao shortcut MapApp (co icon) ngoai Desktop. Dat file nay o goc kho, canh thu muc app\.
set "EXE=%~dp0app\win\MapApp.exe"
if not exist "%EXE%" (
  echo Khong thay %EXE%
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\MapApp.lnk'); $s.TargetPath='%EXE%'; $s.WorkingDirectory=Split-Path '%EXE%'; $s.IconLocation='%EXE%,0'; $s.Description='MapApp'; $s.Save()"
if errorlevel 1 (
  echo Khong tao duoc shortcut.
  pause
  exit /b 1
)
echo Da tao shortcut MapApp tren Desktop. Lan sau chi can bam icon do.
echo Muon ghim len thanh tac vu: bam phai vao shortcut, chon Pin to taskbar.
pause
