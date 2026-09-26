$ErrorActionPreference = "Stop"

$moduleRoot = Split-Path -Parent $PSScriptRoot
if ((Split-Path -Leaf $moduleRoot) -ne "cv-module") {
    throw "Gemini smoke tests must run from the cv-module workspace."
}

Push-Location $moduleRoot
try {
    $python = Join-Path $moduleRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $python)) {
        throw "Create .venv and install the project before running the smoke test."
    }
    & $python scripts\smoke_gemini.py
}
finally {
    Pop-Location
}
