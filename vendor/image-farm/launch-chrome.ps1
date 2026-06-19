# chatgpt-image-farm Chrome launcher.
# Opens Chrome with a dedicated, persistent profile and remote debugging on :9222
# so the Node server can attach via CDP and open extra tabs for parallel generation.
#
# Run this ONCE, then sign in to ChatGPT in the window that opens.
# The login is stored in the profile dir and reused on every later run.
#
# Usage:
#   .\launch-chrome.ps1
#   .\launch-chrome.ps1 -ProfileDir "D:\my-profiles\image-farm" -Port 9222
param(
  [string]$ProfileDir = "$env:LOCALAPPDATA\chatgpt-image-farm\chrome-profile",
  [int]$Port = 9222,
  [string]$Address = "127.0.0.1"
)

$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw "chrome.exe not found in standard locations." }

if (-not (Test-Path $ProfileDir)) {
  New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
}

$chromeArgs = @(
  "--remote-debugging-address=$Address",
  "--remote-debugging-port=$Port",
  "--user-data-dir=$ProfileDir",
  "--no-first-run",
  "--no-default-browser-check",
  "https://chatgpt.com/?model=gpt-4o"
)

Write-Host "Launching Chrome (debug $Address`:$Port, profile $ProfileDir)"
Write-Host "Sign in to ChatGPT in the window that opens, then start the server: npm start"
Start-Process -FilePath $chrome -ArgumentList $chromeArgs | Out-Null
