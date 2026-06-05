# web-image-forge Chrome launcher — remote debugging :9222 + ChatGPT 로그인 프로필 유지
param(
  [string]$ProfileDir = "$env:LOCALAPPDATA\loadout\chrome-profile",
  [int]$Port = 9222,
  [string]$Address = "127.0.0.1"
)
$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw "chrome.exe not found." }
if (-not (Test-Path $ProfileDir)) { New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null }
$chromeArgs = @(
  "--remote-debugging-address=$Address", "--remote-debugging-port=$Port",
  "--user-data-dir=$ProfileDir", "--no-first-run", "--no-default-browser-check",
  "https://chatgpt.com/?model=gpt-4o"
)
Write-Host "Launching Chrome (debug $Address`:$Port, profile $ProfileDir). ChatGPT에 로그인하세요."
Start-Process -FilePath $chrome -ArgumentList $chromeArgs | Out-Null
