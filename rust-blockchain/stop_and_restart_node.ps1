Set-Location -LiteralPath 'C:\Users\lumji\Desktop\Github\wallet-ui\rust-blockchain'
$procs = Get-Process -Name blockchain-node -ErrorAction SilentlyContinue
if ($procs) {
    foreach ($p in $procs) {
        Write-Host "Stopping PID $($p.Id)"
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host 'No blockchain-node process found'
}
Start-Sleep -Milliseconds 500
$lockPath = '.\\blockchain_ledger_db\\LOCK'
if (Test-Path $lockPath) {
    Write-Host 'Removing LOCK...'
    Remove-Item -Force $lockPath -ErrorAction SilentlyContinue
    if (Test-Path $lockPath) {
        Write-Host 'LOCK still present'
    } else {
        Write-Host 'LOCK removed'
    }
} else {
    Write-Host 'No LOCK file'
}
Write-Host 'Starting node...'
& .\run_node_with_vcvars.cmd
