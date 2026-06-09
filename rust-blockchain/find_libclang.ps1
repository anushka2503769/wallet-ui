$paths = @(
    'C:\Program Files\LLVM',
    'C:\Program Files (x86)\LLVM',
    'C:\Program Files (x86)\Microsoft Visual Studio',
    'C:\Program Files\Microsoft Visual Studio'
)
foreach ($base in $paths) {
    if (Test-Path $base) {
        $found = Get-ChildItem $base -Recurse -Filter 'libclang.dll' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { Write-Output $found.FullName; exit 0 }
    }
}
Write-Output 'LIBCLANG_NOT_FOUND'
exit 2
