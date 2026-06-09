$roots = @('C:\Program Files (x86)\Microsoft Visual Studio','C:\Program Files\Microsoft Visual Studio')
foreach ($r in $roots) {
    if (Test-Path $r) {
        $p = Get-ChildItem $r -Recurse -Filter 'vcvars64.bat' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($p) {
            Write-Output $p.FullName
            exit 0
        }
    }
}
Write-Output 'VCVARS_NOT_FOUND'
exit 2
