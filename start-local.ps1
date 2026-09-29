[CmdletBinding()]
param(
  [switch]$NoWatch,
  [switch]$Check
)

$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$serverRoot = Join-Path $projectRoot "server"
$clientRoot = Join-Path $projectRoot "client"

function Test-NodeRuntime {
  param([string]$Candidate)

  if ([string]::IsNullOrWhiteSpace($Candidate) -or -not (Test-Path -LiteralPath $Candidate -PathType Leaf)) {
    return $false
  }

  $null = & $Candidate -e "require('dns').lookup('localhost', error => process.exit(error ? 1 : 0))" 2>$null
  $nodeExitCode = $LASTEXITCODE
  return ($nodeExitCode -eq 0)
}

$commandNode = Get-Command node -ErrorAction SilentlyContinue
$nodeCandidates = @(
  $env:QUIZ_MASTER_NODE,
  $env:DNM_NODE_EXE,
  (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"),
  (Join-Path $env:USERPROFILE "Tools\node\node.exe"),
  $(if ($commandNode) { $commandNode.Source })
) | Where-Object { $_ } | Select-Object -Unique

$nodeExe = $nodeCandidates | Where-Object { Test-NodeRuntime $_ } | Select-Object -First 1
if (-not $nodeExe) {
  throw "localhost adini cozebilen bir Node.js bulunamadi. QUIZ_MASTER_NODE degiskenini calisan node.exe yoluna ayarlayin."
}

$tsxCli = Join-Path $serverRoot "node_modules\tsx\dist\cli.mjs"
$prismaCli = Join-Path $serverRoot "node_modules\prisma\build\index.js"
$prismaSchema = Join-Path $serverRoot "prisma\schema.prisma"
$viteCli = Join-Path $clientRoot "node_modules\vite\bin\vite.js"

foreach ($requiredFile in @($tsxCli, $prismaCli, $prismaSchema, $viteCli)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "Gerekli dosya bulunamadi: $requiredFile. Once bagimlilik kurulumunu tamamlayin."
  }
}

$nodeVersion = & $nodeExe --version
Write-Host "Quiz-Master Node: $nodeVersion ($nodeExe)" -ForegroundColor Cyan

if ($Check) {
  Write-Host "Node ve proje araclari kullanima hazir." -ForegroundColor Green
  return
}

$virtualStore = Join-Path $projectRoot "node_modules\.pnpm"
$generatedPrismaClient = Get-ChildItem -LiteralPath $virtualStore -Directory -Filter "@prisma+client@*" -ErrorAction SilentlyContinue |
  Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "node_modules\.prisma\client\index.js") -PathType Leaf } |
  Select-Object -First 1

if (-not $generatedPrismaClient) {
  Write-Host "Prisma Client hazirlaniyor..." -ForegroundColor Cyan
  & $nodeExe $prismaCli generate --schema $prismaSchema
  if ($LASTEXITCODE -ne 0) {
    throw "Prisma Client uretilemedi (cikis kodu: $LASTEXITCODE)."
  }
} else {
  Write-Host "Prisma Client hazir." -ForegroundColor DarkGray
}

$serverArguments = @($tsxCli)
if ($NoWatch) {
  $serverArguments += "index.ts"
} else {
  $serverArguments += @(
    "watch",
    "--exclude", "../node_modules/**",
    "--exclude", "node_modules/**",
    "index.ts"
  )
}

$serverProcess = $null
$clientProcess = $null

try {
  Write-Host "Backend baslatiliyor: http://127.0.0.1:5000" -ForegroundColor Green
  $serverProcess = Start-Process -FilePath $nodeExe -ArgumentList $serverArguments -WorkingDirectory $serverRoot -NoNewWindow -PassThru

  Start-Sleep -Seconds 2
  if ($serverProcess.HasExited) {
    throw "Backend baslatilamadi (cikis kodu: $($serverProcess.ExitCode))."
  }

  Write-Host "Frontend baslatiliyor: http://127.0.0.1:5173" -ForegroundColor Green
  $clientProcess = Start-Process -FilePath $nodeExe -ArgumentList @($viteCli) -WorkingDirectory $clientRoot -NoNewWindow -PassThru

  while (-not $serverProcess.HasExited -and -not $clientProcess.HasExited) {
    Start-Sleep -Seconds 1
    $serverProcess.Refresh()
    $clientProcess.Refresh()
  }

  if ($serverProcess.HasExited) {
    throw "Backend kapandi (cikis kodu: $($serverProcess.ExitCode))."
  }

  throw "Frontend kapandi (cikis kodu: $($clientProcess.ExitCode))."
} finally {
  foreach ($process in @($clientProcess, $serverProcess)) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
    }
  }
}
