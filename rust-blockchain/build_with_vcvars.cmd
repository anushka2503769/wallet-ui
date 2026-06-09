@echo off
REM Call MSVC environment setup
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo Failed to call vcvars64.bat
  exit /b %ERRORLEVEL%
)
echo MSVC environment set.
rustup toolchain install stable-x86_64-pc-windows-msvc
rustup override set stable-x86_64-pc-windows-msvc
cd /d C:\Users\lumji\Desktop\Github\wallet-ui\rust-blockchain
nset RUST_BACKTRACE=1
cargo clean
cargo build --bins -vv
exit /b %ERRORLEVEL%
