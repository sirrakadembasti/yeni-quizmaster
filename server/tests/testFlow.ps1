#!/usr/bin/env pwsh
$ErrorActionPreference = 'Continue'
$WarningPreference = 'Continue'

$base = 'http://127.0.0.1:5000'
$rand = [int][double]::Parse((Get-Date -UFormat %s)) 
$email = "testuser$rand@example.com"
$password = 'Test1234!'
$name = 'Test User'

$headers = @{'Content-Type'='application/json'}

try {
    # Register
    Write-Output "=== REGISTER ==="
    $body = @{name=$name; email=$email; password=$password} | ConvertTo-Json
Write-Output "Request body: $body"
    $reg = Invoke-WebRequest -Uri "$base/api/auth/register" -Method POST -Headers $headers -Body $body -UseBasicParsing -SessionVariable ws
    Write-Output "Status: $($reg.StatusCode)"
    Write-Output "Response: $($reg.Content)"

    # Get cookies from response  
    $setCookie = $reg.Headers['Set-Cookie']
    Write-Output "Set-Cookie header: $setCookie"

    # Update profile
    Write-Output "`n=== UPDATE PROFILE ==="
    $newName = "$name Updated"
    $upd = Invoke-WebRequest -Uri "$base/api/auth/me" -Method PATCH -Headers $headers -Body (ConvertTo-Json @{name=$newName}) -UseBasicParsing -WebSession $ws
    Write-Output "Status: $($upd.StatusCode)"
    Write-Output "Response: $($upd.Content)"

    # Get current user
    Write-Output "`n=== GET /api/auth/me ==="
    $me = Invoke-WebRequest -Uri "$base/api/auth/me" -Method GET -UseBasicParsing -WebSession $ws
    Write-Output "Status: $($me.StatusCode)"
    Write-Output "Response: $($me.Content)"

    # Change password
    Write-Output "`n=== CHANGE PASSWORD ==="
    $newPassword = 'NewTest1234!'
    $chBody = @{currentPassword=$password; newPassword=$newPassword} | ConvertTo-Json
    $ch = Invoke-WebRequest -Uri "$base/api/auth/password" -Method PATCH -Headers $headers -Body $chBody -UseBasicParsing -WebSession $ws
   Write-Output "Status: $($ch.StatusCode)"
    Write-Output "Response: $($ch.Content)"

    # Login with new password
    Write-Output "`n=== LOGIN ==="
    $loginBody = @{email=$email; password=$newPassword} | ConvertTo-Json
    $login = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -Headers $headers -Body $loginBody -UseBasicParsing
    Write-Output "Status: $($login.StatusCode)"
    Write-Output "Response: $($login.Content)"

    Write-Output "`n=== ALL TESTS PASSED ==="
    exit 0
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
}
