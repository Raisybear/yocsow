Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$nodeHome = [Environment]::GetEnvironmentVariable(
    "YOCSOW_NODE_HOME",
    "User"
)

$javaHome = [Environment]::GetEnvironmentVariable(
    "JAVA_HOME",
    "User"
)

if ([string]::IsNullOrWhiteSpace($nodeHome)) {
    throw "YOCSOW_NODE_HOME is not configured for the current user."
}

if ([string]::IsNullOrWhiteSpace($javaHome)) {
    throw "JAVA_HOME is not configured for the current user."
}

$nodeExecutable = Join-Path $nodeHome "node.exe"
$javaExecutable = Join-Path $javaHome "bin\java.exe"

if (-not (Test-Path $nodeExecutable)) {
    throw "Node was not found at $nodeExecutable"
}

if (-not (Test-Path $javaExecutable)) {
    throw "Java was not found at $javaExecutable"
}

$env:YOCSOW_NODE_HOME = $nodeHome
$env:JAVA_HOME = $javaHome

$projectPaths = @(
    $nodeHome
    (Join-Path $javaHome "bin")
)

$currentPaths = $env:Path `
    -split ";" |
    Where-Object {
        -not [string]::IsNullOrWhiteSpace($_)
    }

$env:Path = (
    $projectPaths + $currentPaths |
    Select-Object -Unique
) -join ";"

Write-Host ""
Write-Host "YOCSOW Windows toolchain activated"
Write-Host ""

node --version
npm --version
java --version
rustc --version
cargo --version