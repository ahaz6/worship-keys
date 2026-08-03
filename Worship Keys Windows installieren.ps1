[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Repository = "ahaz6/worship-keys"
$TargetDirectory = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Worship Keys"
$MinimumNodeMajor = 22
$InstallerDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$TemporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("worship-keys-installer-" + [guid]::NewGuid())

function Write-Headline {
  Clear-Host
  Write-Host "============================================================" -ForegroundColor DarkMagenta
  Write-Host "         WORSHIP KEYS - WINDOWS-INSTALLATION" -ForegroundColor White
  Write-Host "============================================================" -ForegroundColor DarkMagenta
  Write-Host ""
}

function Stop-WithError([string]$Message) {
  Write-Host ""
  Write-Host "FEHLER: $Message" -ForegroundColor Red
  Write-Host ""
  Read-Host "Druecke die Eingabetaste zum Schliessen"
  exit 1
}

function Refresh-Path {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
}

function Test-NodeReady {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $node -or -not $npm) { return $false }
  try {
    $major = [int]((& $node.Source -p "Number(process.versions.node.split('.')[0])").Trim())
    return $major -ge $MinimumNodeMajor
  } catch {
    return $false
  }
}

function Install-WingetPackage([string]$Id, [string]$Name) {
  Write-Host "$Name wird ueber den offiziellen Windows-Paketmanager installiert ..."
  & winget.exe install --id $Id --exact --silent --disable-interactivity `
    --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    throw "$Name konnte nicht installiert werden (winget-Code $LASTEXITCODE)."
  }
  Refresh-Path
}

function Ensure-Prerequisites {
  if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
    Stop-WithError "Windows App Installer (winget) fehlt. Installiere zuerst 'App Installer' aus dem Microsoft Store und starte diesen Assistenten erneut."
  }
  if (-not (Test-NodeReady)) {
    Install-WingetPackage "OpenJS.NodeJS.LTS" "Node.js LTS"
  }
  if (-not (Test-NodeReady)) {
    Stop-WithError "Node.js LTS wurde installiert, ist aber noch nicht verfuegbar. Starte Windows neu und fuehre den Installer erneut aus."
  }
  if (-not (Get-Command gh.exe -ErrorAction SilentlyContinue)) {
    Install-WingetPackage "GitHub.cli" "GitHub CLI"
  }
  if (-not (Get-Command gh.exe -ErrorAction SilentlyContinue)) {
    Stop-WithError "Die sichere GitHub-Anmeldung wurde nicht gefunden."
  }
}

function Get-WorshipKeysProject {
  if ((Test-Path (Join-Path $InstallerDirectory "package.json")) -and
      (Test-Path (Join-Path $InstallerDirectory "package-lock.json"))) {
    return $InstallerDirectory
  }

  & gh.exe auth status --hostname github.com *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "GitHub oeffnet jetzt den Browser."
    Write-Host "Melde dich mit einem Konto an, das Zugriff auf $Repository hat."
    & gh.exe auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) { Stop-WithError "Die GitHub-Anmeldung wurde abgebrochen." }
  }

  & gh.exe repo view $Repository *> $null
  if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Dieses GitHub-Konto hat keinen Zugriff auf das private Worship-Keys-Repository."
  }

  New-Item -ItemType Directory -Path $TemporaryDirectory -Force | Out-Null
  $archive = Join-Path $TemporaryDirectory "worship-keys.zip"
  Write-Host "Die aktuelle Worship-Keys-Version wird geladen ..."
  $token = (& gh.exe auth token).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
    Stop-WithError "Das GitHub-Zugriffstoken konnte nicht gelesen werden."
  }
  $headers = @{
    Authorization = "Bearer $token"
    Accept = "application/vnd.github+json"
    "User-Agent" = "Worship-Keys-Installer"
  }
  Invoke-WebRequest -UseBasicParsing -Uri "https://api.github.com/repos/$Repository/zipball/main" -Headers $headers -OutFile $archive
  $token = $null
  if (-not (Test-Path $archive)) {
    Stop-WithError "Worship Keys konnte nicht von GitHub geladen werden."
  }

  $extracted = Join-Path $TemporaryDirectory "project"
  Expand-Archive -LiteralPath $archive -DestinationPath $extracted -Force
  $source = Get-ChildItem -LiteralPath $extracted -Directory | Select-Object -First 1
  if (-not $source -or -not (Test-Path (Join-Path $source.FullName "package.json"))) {
    Stop-WithError "Das heruntergeladene Worship-Keys-Paket ist unvollstaendig."
  }

  if (Test-Path $TargetDirectory) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH-mm-ss"
    $backup = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Worship Keys Backup $timestamp"
    Write-Host "Die vorhandene Installation wird gesichert: $backup"
    Move-Item -LiteralPath $TargetDirectory -Destination $backup
  }
  Move-Item -LiteralPath $source.FullName -Destination $TargetDirectory
  return $TargetDirectory
}

function Install-WindowsLaunchers([string]$ProjectDirectory) {
  $supportDirectory = Join-Path $env:LOCALAPPDATA "Worship Keys"
  $startMenuDirectory = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Worship Keys"
  $desktopDirectory = [Environment]::GetFolderPath("Desktop")
  New-Item -ItemType Directory -Path $supportDirectory -Force | Out-Null
  New-Item -ItemType Directory -Path $startMenuDirectory -Force | Out-Null

  $nodePath = (Get-Command node.exe).Source
  $statePath = Join-Path $supportDirectory "server.json"
  $logPath = Join-Path $supportDirectory "server.log"
  $errorLogPath = Join-Path $supportDirectory "server-error.log"
  $startScript = Join-Path $supportDirectory "Start-WorshipKeys.ps1"
  $stopScript = Join-Path $supportDirectory "Stop-WorshipKeys.ps1"

  $startContent = @"
`$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
`$project = '$($ProjectDirectory.Replace("'", "''"))'
`$node = '$($nodePath.Replace("'", "''"))'
`$state = '$($statePath.Replace("'", "''"))'
`$health = 'http://127.0.0.1:3000/api/session/bootstrap'
try { if ((Invoke-WebRequest -UseBasicParsing -Uri `$health -TimeoutSec 1).StatusCode -eq 200) { Start-Process 'http://localhost:3000'; exit 0 } } catch {}
`$env:NODE_ENV = 'production'
`$env:PORT = '3000'
`$env:WK_CHURCH_MODE = '1'
`$process = Start-Process -FilePath `$node -ArgumentList 'server.mjs' -WorkingDirectory `$project -WindowStyle Hidden -RedirectStandardOutput '$($logPath.Replace("'", "''"))' -RedirectStandardError '$($errorLogPath.Replace("'", "''"))' -PassThru
@{ Pid = `$process.Id; StartTime = `$process.StartTime.ToFileTimeUtc(); Project = `$project } | ConvertTo-Json | Set-Content -LiteralPath `$state -Encoding UTF8
for (`$attempt = 0; `$attempt -lt 80; `$attempt++) {
  try { if ((Invoke-WebRequest -UseBasicParsing -Uri `$health -TimeoutSec 1).StatusCode -eq 200) { Start-Process 'http://localhost:3000'; exit 0 } } catch {}
  Start-Sleep -Milliseconds 250
}
[System.Windows.Forms.MessageBox]::Show('Worship Keys konnte nicht gestartet werden. Pruefe die Logdatei unter LocalAppData\Worship Keys.', 'Worship Keys') | Out-Null
exit 1
"@

  $stopContent = @"
`$ErrorActionPreference = 'SilentlyContinue'
`$state = '$($statePath.Replace("'", "''"))'
if (-not (Test-Path -LiteralPath `$state)) { exit 0 }
`$saved = Get-Content -LiteralPath `$state -Raw | ConvertFrom-Json
`$process = Get-Process -Id ([int]`$saved.Pid) -ErrorAction SilentlyContinue
if (`$process -and `$process.StartTime.ToFileTimeUtc() -eq [long]`$saved.StartTime -and `$process.ProcessName -eq 'node') {
  Stop-Process -Id `$process.Id -Force
}
Remove-Item -LiteralPath `$state -Force
"@

  Set-Content -LiteralPath $startScript -Value $startContent -Encoding UTF8
  Set-Content -LiteralPath $stopScript -Value $stopContent -Encoding UTF8

  Add-Type -AssemblyName System.Windows.Forms
  $shell = New-Object -ComObject WScript.Shell
  $powershell = (Get-Command powershell.exe).Source
  foreach ($entry in @(
    @{ Name = "Worship Keys Church"; Script = $startScript },
    @{ Name = "Stop Worship Keys"; Script = $stopScript }
  )) {
    foreach ($directory in @($desktopDirectory, $startMenuDirectory)) {
      $shortcut = $shell.CreateShortcut((Join-Path $directory ($entry.Name + ".lnk")))
      $shortcut.TargetPath = $powershell
      $shortcut.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$($entry.Script)`""
      $shortcut.WorkingDirectory = $ProjectDirectory
      $shortcut.Save()
    }
  }
}

try {
  Write-Headline
  Write-Host "Dieser Assistent installiert Node.js LTS, laedt Worship Keys"
  Write-Host "und erstellt Start-/Stop-Verknuepfungen."
  Write-Host ""
  Ensure-Prerequisites
  Write-Host "OK: Node.js $(& node.exe --version) ist bereit." -ForegroundColor Green

  $project = Get-WorshipKeysProject
  Write-Host "OK: Worship Keys liegt unter $project" -ForegroundColor Green
  Push-Location $project
  try {
    Write-Host "Abhaengigkeiten werden installiert ..."
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw "npm install ist fehlgeschlagen." }
    Write-Host "Die Produktionsversion wird erstellt ..."
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build ist fehlgeschlagen." }
  } finally {
    Pop-Location
  }

  Install-WindowsLaunchers $project
  Write-Host ""
  Write-Host "INSTALLATION ERFOLGREICH" -ForegroundColor Green
  Write-Host "Auf dem Desktop und im Startmenue befinden sich jetzt:"
  Write-Host "  - Worship Keys Church"
  Write-Host "  - Stop Worship Keys"
  Write-Host ""
  Write-Host "Den Ordner '$project' bitte nicht verschieben oder loeschen."
  Read-Host "Druecke die Eingabetaste zum Schliessen"
} catch {
  Stop-WithError $_.Exception.Message
} finally {
  if (Test-Path $TemporaryDirectory) {
    Remove-Item -LiteralPath $TemporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
  }
}
