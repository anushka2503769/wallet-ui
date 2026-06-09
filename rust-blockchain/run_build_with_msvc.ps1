# Locate vcvars64.bat and run cargo build inside an MSVC-enabled cmd session
$p = Get-ChildItem 'C:\Program Files (x86)\Microsoft Visual Studio' -Recurse -Filter 'vcvars64.bat' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $p) {
    Write-Output 'VCVARS_NOT_FOUND'
    exit 2
}
$vc = $p.FullName
Write-Output "Found vcvars: $vc"

# Build command executed under cmd.exe so vcvars affects the same process
$cmd = '"' + $vc + '" >nul && rustup toolchain install stable-x86_64-pc-windows-msvc && rustup override set stable-x86_64-pc-windows-msvc && cd /d C:\Users\lumji\Desktop\Github\wallet-ui\rust-blockchain && set RUST_BACKTRACE=1 && cargo clean && cargo build --bins -vv'
Write-Output "Running: $cmd"

# Execute and forward exit code
$proc = Start-Process -FilePath cmd.exe -ArgumentList '/c', $cmd -NoNewWindow -Wait -PassThru
exit $proc.ExitCode
