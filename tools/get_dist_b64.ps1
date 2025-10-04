$ErrorActionPreference = 'Stop'
$root = (Resolve-Path 'dist').Path
Get-ChildItem -Recurse -File 'dist' | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
    $bytes = [IO.File]::ReadAllBytes($_.FullName)
    $b64 = [Convert]::ToBase64String($bytes)
    Write-Output ("{0}:::{1}" -f $rel, $b64)
}

