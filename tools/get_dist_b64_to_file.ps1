$ErrorActionPreference = 'Stop'
$root = (Resolve-Path 'dist').Path
$outFile = 'tools/dist_b64.jsonl'
if (Test-Path $outFile) { Remove-Item $outFile }
Get-ChildItem -Recurse -File 'dist' | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
    $bytes = [IO.File]::ReadAllBytes($_.FullName)
    $b64 = [Convert]::ToBase64String($bytes)
    $obj = @{ path = $rel; b64 = $b64 }
    $json = $obj | ConvertTo-Json -Compress
    Add-Content -Path $outFile -Value $json
}

