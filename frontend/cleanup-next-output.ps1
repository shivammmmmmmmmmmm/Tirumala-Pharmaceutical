# Cleans Next.js build artifacts

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Remove-Item -Recurse -Force (Join-Path $root '.next') -ErrorAction SilentlyContinue
Remove-Item -Force (Join-Path $root 'out') -ErrorAction SilentlyContinue

Write-Host 'Next artifacts cleaned.'

