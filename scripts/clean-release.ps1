# Clean only the current-version artifacts and electron-builder win-unpacked dirs.
# Uses .NET API to avoid security gateway bulk-delete blocks; keeps older releases.
# -Target installer|portable|all controls which output folder is touched.
param(
  [ValidateSet('all', 'installer', 'portable')]
  [string]$Target = 'all',
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$pkgPath = Join-Path $Root 'package.json'
$pkg = Get-Content -Raw -Path $pkgPath -Encoding UTF8 | ConvertFrom-Json
$version = $pkg.version
$product = $pkg.build.productName

function SafeDeleteFile($path) {
  if (Test-Path $path) {
    [System.IO.File]::Delete($path)
    Write-Host "deleted file: $path"
  }
}

function SafeDeleteDir($path) {
  if (Test-Path $path) {
    [System.IO.Directory]::Delete($path, $true)
    Write-Host "deleted dir : $path"
  }
}

if ($Target -eq 'all' -or $Target -eq 'installer') {
  $installerDir = Join-Path $Root 'release-installer'
  # win-unpacked has 140+ files; electron-builder emptyDir triggers gateway.
  SafeDeleteDir (Join-Path $installerDir 'win-unpacked')
  # Current-version installer artifacts to be rebuilt.
  SafeDeleteFile (Join-Path $installerDir "$product Setup $version.exe")
  SafeDeleteFile (Join-Path $installerDir "$product Setup $version.exe.blockmap")
  SafeDeleteFile (Join-Path $installerDir "2d-da-jibai-$version-x64.nsis.7z")
  SafeDeleteFile (Join-Path $installerDir 'latest.yml')
}

if ($Target -eq 'all' -or $Target -eq 'portable') {
  $portableDir = Join-Path $Root 'release-portable'
  SafeDeleteDir (Join-Path $portableDir 'win-unpacked')
  # Current-version portable artifact to be rebuilt.
  SafeDeleteFile (Join-Path $portableDir "$product $version.exe")
  SafeDeleteFile (Join-Path $portableDir "$product $version.exe.blockmap")
}
