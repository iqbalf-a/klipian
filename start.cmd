@echo off
rem klipian -- start the local server. Run it from cmd:
rem
rem   start.cmd          port 5177   (type "st" then Tab)
rem   start.cmd 5180     another port
rem
rem Not plain "start": that is cmd's own command. Runs from .venv, never the
rem global Python (README, "First-time setup"). Ctrl+C stops the server.
rem It does not open a browser: open the address it prints yourself.
rem Set KLIPIAN_OPEN_BROWSER=1 to have it open a tab for you.

setlocal
cd /d "%~dp0"

set "PORT=%~1"
if "%PORT%"=="" set "PORT=5177"
set "URL=http://127.0.0.1:%PORT%"
set "PY=.venv\Scripts\python.exe"

if not exist "%PY%" (
  echo.
  echo   .venv not found. Create it once ^(Python 3.14^):
  echo.
  echo     py -3.14 -m venv .venv
  echo     .venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-ai-framing.txt
  echo.
  exit /b 1
)

where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo.
  echo   ffmpeg is not on PATH. Transcription and rendering need it.
  echo   Install it, e.g.:  winget install Gyan.FFmpeg
  echo.
  exit /b 1
)

rem Already running on this port? Then just open the editor.
netstat -ano | findstr /r /c:"127.0.0.1:%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo   klipian is already running at %URL%
  echo.
  if defined KLIPIAN_OPEN_BROWSER start "" "%URL%"
  exit /b 0
)

rem Open a browser only when asked (KLIPIAN_OPEN_BROWSER=1); otherwise just say where it is.
if defined KLIPIAN_OPEN_BROWSER start "" /b cmd /c "timeout /t 3 /nobreak >nul & start %URL%"
echo.
echo   klipian: open %URL% in your browser
echo.

"%PY%" -m klipian serve --port %PORT%
endlocal
