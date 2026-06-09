Set-Location -LiteralPath 'C:\Users\lumji\Desktop\Github\wallet-ui\rust-blockchain'
Write-Host 'Running CLI: deploy -> mine -> query_state'
# Deploy
$outLines = & .\target\debug\blockchain-cli.exe deploy --hex-bytecode deadbeef --method init 2>&1
$out = $outLines -join "`n"
Write-Host '== DEPLOY OUTPUT =='
Write-Host $out
# extract JSON from output
$idx = $out.IndexOf('{')
if ($idx -ge 0) {
    $json = $out.Substring($idx)
    try {
        $obj = $json | ConvertFrom-Json
        $txid = $obj.id
        Write-Host "Parsed tx id: $txid"
    } catch {
        Write-Host 'Failed to parse JSON from deploy output'
        exit 1
    }
} else {
    Write-Host 'No JSON in deploy output'
    exit 1
}

# Mine
$mineLines = & .\target\debug\blockchain-cli.exe mine 2>&1
$mineOut = $mineLines -join "`n"
Write-Host '== MINE OUTPUT =='
Write-Host $mineOut

# Query State: contract id 'contract' and key slot txid
$queryLines = & .\target\debug\blockchain-cli.exe query-state --contract-id contract --key-slot $txid 2>&1
$queryOut = $queryLines -join "`n"
Write-Host '== QUERY OUTPUT =='
Write-Host $queryOut
