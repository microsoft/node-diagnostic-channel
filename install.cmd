rem Helper script to compile/install the packages in the correct order
@echo off
setlocal enableDelayedExpansion

echo Installing DiagnosticsSource
pushd %~dp0\src\diagnostic-channel
cmd.exe /c "npm run clean && npm install && npm test"
popd

echo Installing DiagnosticsSource Publishers
pushd %~dp0\src\diagnostic-channel-publishers
cmd.exe /c "npm run clean && npm install && npm test"
popd


for /F %%x in ('dir /B/D %~dp0\src\subs') do (
    IF NOT "%%x"==".gitignore" (
        echo -------------------- Installing %%x
        pushd %~dp0\src\subs\%%x
        cmd.exe /c "npm install && npm test"
        popd
    )
)
