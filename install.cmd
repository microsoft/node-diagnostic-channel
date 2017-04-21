rem Helper script to compile/install the packages in the correct order
@echo off
setlocal enableDelayedExpansion

echo Installing DiagnosticsSource
pushd %~dp0\diagnostic-source
cmd.exe /c "npm install && npm run clean && npm test"
popd

for /F %%x in ('dir /B/D %~dp0\pubs') do (
    echo ----------------------- Installing %%x
    pushd %~dp0\pubs\%%x
    cmd.exe /c "npm install && npm run clean && npm test"
    popd
)

for /F %%x in ('dir /B/D %~dp0\subs') do (
    IF NOT "%%x"==".gitignore" (
        echo -------------------- Installing %%x
        pushd %~dp0\subs\%%x
        cmd.exe /c "npm install && npm test"
        popd
    )
)
