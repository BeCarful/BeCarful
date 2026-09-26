$ErrorActionPreference = "Stop"

$moduleRoot = Split-Path -Parent $PSScriptRoot
if ((Split-Path -Leaf $moduleRoot) -ne "cv-module") {
    throw "Tests must run from the cv-module workspace."
}

Push-Location $moduleRoot
try {
    $python = Join-Path $moduleRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $python)) {
        throw "Create .venv and install the project before running tests."
    }
    & $python -m pytest --cov=cv_module --cov-report=term-missing --cov-fail-under=75
}
finally {
    Pop-Location
}
