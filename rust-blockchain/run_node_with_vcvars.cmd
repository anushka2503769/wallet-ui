@echo off
REM Wrapper to set up MSVC env and run the blockchain-node binary
cd /d "%~dp0"
echo ==== Starting blockchain-node with MSVC environment ====
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" || exit /b %ERRORLEVEL%
set "LIBCLANG_PATH=C:\Program Files\LLVM\bin"
set "RUST_BACKTRACE=1"
echo LIBCLANG_PATH=%LIBCLANG_PATH%
echo Running: "%~dp0target\debug\blockchain-node.exe"
"%~dp0target\debug\blockchain-node.exe"
exit /b %ERRORLEVEL%
