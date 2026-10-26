$ErrorActionPreference = "Stop"
# PowerShell 5.1 里 $LASTEXITCODE 在第一次调用原生命令前可能未定义，
# 此时 `$LASTEXITCODE -ne 0` 会被判成真而误报失败。先显式归零。
$LASTEXITCODE = 0
$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root ".venv-packaging"
$python = Join-Path $venv "Scripts\python.exe"
$dist = Join-Path $root "backend-dist"
$work = Join-Path $root "build\pyinstaller"
$output = Join-Path $dist "desktop-server"
$executable = Join-Path $output "desktop-server.exe"

Push-Location $root
try {
    if (-not (Test-Path $python)) {
        & python -m venv $venv
        if ($LASTEXITCODE -ne 0) { throw "Could not create the packaging Python environment." }
    }

    & $python -m pip install -r (Join-Path $root "requirements-packaging.txt")
    if ($LASTEXITCODE -ne 0) { throw "Could not install backend packaging dependencies." }

    $legacyExecutable = Join-Path $dist "desktop-server.exe"
    if (Test-Path $legacyExecutable) {
        Remove-Item -LiteralPath $legacyExecutable -Force
    }
    if (Test-Path $output) {
        Remove-Item -LiteralPath $output -Recurse -Force
    }

    $arguments = @(
        "--noconfirm",
        "--clean",
        "--name", "desktop-server",
        "--distpath", $dist,
        "--workpath", $work,
        "--specpath", $work,
        "--add-data", "$(Join-Path $root 'templates');templates",
        "--add-data", "$(Join-Path $root 'static');static",
        "--add-data", "$(Join-Path $root 'locale');locale",
        "--add-data", "$(Join-Path $root 'assets');assets",
        (Join-Path $root "desktop_server.py")
    )
    & $python -m PyInstaller @arguments
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed to build the Flask backend." }
    if (-not (Test-Path $executable)) { throw "PyInstaller did not create the expected backend executable." }
}
finally {
    Pop-Location
}
