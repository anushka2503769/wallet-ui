# Use the script directory so the path stays portable in Git
if ($PSScriptRoot) {
    $scriptRoot = $PSScriptRoot
} else {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
Set-Location -LiteralPath $scriptRoot
Write-Host "Running CLI in: $scriptRoot - deploy -> mine -> query_state"
# Helper: locate built CLI or fall back to `cargo run`
function Invoke-BlockchainCli {
    param([Parameter(ValueFromRemainingArguments=$true)] [string[]]$Args)

    $candidates = @(
        "$scriptRoot\target\debug\blockchain-cli.exe",
        "$scriptRoot\target\debug\blockchain_cli.exe",
        "$scriptRoot\target\debug\deps\blockchain-cli.exe",
        "$scriptRoot\target\debug\deps\blockchain_cli.exe"
    )
    foreach ($p in $candidates) {
        if (Test-Path $p) {
            Write-Host "Using CLI binary: $p"
            return & $p @Args 2>&1
        }
    }

    if (Get-Command cargo -ErrorAction SilentlyContinue) {
        Write-Host "CLI binary not found; running: cargo run --bin blockchain-cli -- $($Args -join ' ')"
        # Run cargo, merge stderr but then filter out cargo's build lines
        $output = & cargo run --bin blockchain-cli -- @Args 2>&1
        # Keep only lines that look like JSON (start with '{' or '[' after whitespace)
        $jsonLines = $output | Where-Object { $_ -match '^\s*[\{\[]' }
        if ($jsonLines) {
            return $jsonLines
        } else {
            # Fallback: return all output (maybe the CLI didn't print JSON)
            return $output
        }
    }

    Write-Host "CLI binary not found and 'cargo' is not available. Searched: $($candidates -join ', ')"
    exit 1
}

# Deploy
$outLines = Invoke-BlockchainCli deploy --hex-bytecode deadbeef --method init
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
$mineLines = Invoke-BlockchainCli mine
$mineOut = $mineLines -join "`n"
Write-Host '== MINE OUTPUT =='
Write-Host $mineOut

# Query State: contract id 'contract' and key slot txid
$queryLines = Invoke-BlockchainCli query-state --contract-id contract --key-slot $txid
$queryOut = $queryLines -join "`n"
Write-Host '== QUERY OUTPUT =='
Write-Host $queryOut
