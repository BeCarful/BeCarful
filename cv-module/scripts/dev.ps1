$ErrorActionPreference = "Stop"

$moduleRoot = Split-Path -Parent $PSScriptRoot
if ((Split-Path -Leaf $moduleRoot) -ne "cv-module") {
    throw "Development commands must run from the cv-module workspace."
}

Push-Location $moduleRoot
try {
    $python = Join-Path $moduleRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $python)) {
        throw "Create .venv and install the project before starting the local API."
    }
    & $python -m uvicorn cv_module.api.app:app --host 127.0.0.1 --port 8000
}
finally {
    Pop-Location
}
