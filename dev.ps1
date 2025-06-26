# PowerShell用開発起動スクリプト
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:NODE_OPTIONS = "--max-old-space-size=4096"
electron . --dev 