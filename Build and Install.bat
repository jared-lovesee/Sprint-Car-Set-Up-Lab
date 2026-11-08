@echo off
rem Double-click to build Sprint Car Setup Lab from this folder and put it on your Desktop
rem and Start menu. Pass "nosign" to skip code signing (the exe then warns on other PCs).
setlocal
cd /d "%~dp0launcher"

set "GO=go"
where go >nul 2>nul || set "GO=C:\Program Files\Go\bin\go.exe"
if not exist "%GO%" if not "%GO%"=="go" (
  echo Go is not installed. Get it from https://go.dev/dl/ and run this again.
  pause & exit /b 1
)

echo Building...
"%GO%" build -trimpath -ldflags "-s -w -H windowsgui" -o SprintCarSetupLab.exe . || (echo. & echo Build failed. See the error above. & pause & exit /b 1)

if /i "%~1"=="nosign" (echo Skipping signing. & goto copy)

rem these three paths change only if the SDK build tools or signing client packages are updated
set "SIGNTOOL=C:\Users\Jared\tools\signing\sdk\bin\10.0.28000.0\x64\signtool.exe"
set "SIGNDLIB=C:\Users\Jared\tools\signing\client\bin\x64\Azure.CodeSigning.Dlib.dll"
set "SIGNMETA=C:\Users\Jared\tools\signing\metadata.json"

echo Signing...
rem /tr timestamps the signature so it stays valid long after the 3-day certificate expires
"%SIGNTOOL%" sign /v /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 /dlib "%SIGNDLIB%" /dmdf "%SIGNMETA%" SprintCarSetupLab.exe || (echo. & echo Signing failed - the exe is NOT signed, do not hand it out. If your sign-in expired, run az login and try again. & pause & exit /b 1)

:copy
set "DEST=%LOCALAPPDATA%\SprintCarSetupLab"
if not exist "%DEST%" mkdir "%DEST%"
rem the app takes a few seconds to quit after its window closes, so retry for up to 15 s
set /a TRIES=0
:copyloop
copy /y SprintCarSetupLab.exe "%DEST%\SprintCarSetupLab.exe" >nul 2>nul && goto copied
set /a TRIES+=1
if %TRIES%==1 echo Waiting for Sprint Car Setup Lab to close...
if %TRIES% lss 15 (timeout /t 1 /nobreak >nul & goto copyloop)
echo. & echo Could not copy the app. Close Sprint Car Setup Lab if it is open, then try again. & pause & exit /b 1
:copied

powershell -NoProfile -Command "$s=New-Object -ComObject WScript.Shell; foreach($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))){ $l=$s.CreateShortcut((Join-Path $d 'Sprint Car Setup Lab.lnk')); $l.TargetPath='%DEST%\SprintCarSetupLab.exe'; $l.WorkingDirectory='%DEST%'; $l.Save() }"

echo.
echo Done. Open "Sprint Car Setup Lab" from your Desktop or Start menu.
pause
