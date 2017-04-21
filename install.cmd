rem Helper script to compile/install the packages in the correct order
@echo off
setlocal enableDelayedExpansion

echo Installing DiagnosticsSource
pushd %~dp0\src\diagnostic-source
cmd.exe /c "npm install && npm run clean && npm test"
popd

for /F %%x in ('dir /B/D %~dp0\src\pubs') do (
    echo ----------------------- Installing %%x
    pushd %~dp0\src\pubs\%%x
    cmd.exe /c "npm install && npm run clean && npm test"
    popd
)

for /F %%x in ('dir /B/D %~dp0\src\subs') do (
    IF NOT "%%x"==".gitignore" (
        echo -------------------- Installing %%x
        pushd %~dp0\src\subs\%%x
        cmd.exe /c "npm install && npm test"
        popd
    )
)
