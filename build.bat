@echo off
chcp 65001 > nul
echo ==========================================
echo   SORTER.IO - BUILD SCRIPT
echo ==========================================
echo.

REM === CẤU HÌNH - SỬA 2 DÒNG NÀY ===
set KEY_PATH=%USERPROFILE%\.tauri\sorter-key.key
set KEY_PASSWORD=matkhau_cua_ban

REM === KIỂM TRA KEY ===
if not exist "%KEY_PATH%" (
  echo [LỖI] Không tìm thấy signing key: %KEY_PATH%
  echo Chạy lệnh sau để tạo:
  echo   npm run tauri signer generate -- -w %KEY_PATH%
  pause
  exit /b 1
)

set TAURI_SIGNING_PRIVATE_KEY=%KEY_PATH%
set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=%KEY_PASSWORD%

cd /d "%~dp0Sorter.io"

echo [1/2] Đang build...
call npm run tauri build

if %errorlevel% neq 0 (
  echo.
  echo [LỖI] Build thất bại!
  pause
  exit /b 1
)

echo.
echo [2/2] Build xong! File ở:
echo   %~dp0Sorter.io\src-tauri\target\release\bundle\nsis\
echo.
dir "%~dp0Sorter.io\src-tauri\target\release\bundle\nsis\*.exe"
echo.

REM === MỞ FOLDER OUTPUT ===
explorer "%~dp0Sorter.io\src-tauri\target\release\bundle\nsis"
pause