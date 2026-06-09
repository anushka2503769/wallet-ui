Write-Host '== POST /tx/submit ==' 
$tx = @{ id = ''; contract_code = $null; contract_action = $null } | ConvertTo-Json
try {
    $r1 = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/tx/submit' -Method Post -ContentType 'application/json' -Body $tx
    $r1 | ConvertTo-Json -Depth 5
} catch {
    Write-Host 'POST /tx/submit failed:' $_.Exception.Message
    exit 1
}

Write-Host '== POST /engine/mine ==' 
try {
    $r2 = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/engine/mine' -Method Post
    $r2 | ConvertTo-Json -Depth 5
} catch {
    Write-Host 'POST /engine/mine failed:' $_.Exception.Message
    exit 1
}
