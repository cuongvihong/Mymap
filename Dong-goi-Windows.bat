@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Dong goi ban Windows (dist:win) ===
call npm install --ignore-scripts || (pause & exit /b 1)
if not exist node_modules\electron\dist\electron.exe node node_modules\electron\install.js
call npm run dist:win || (echo dist:win LOI & pause & exit /b 1)
echo Xong. Mo dist\kho\Mo-MapApp-Windows.bat de chay ban dong goi.
pause
