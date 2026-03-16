$base = 'http://localhost:5000'
$ws = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$rand = [int][double]::Parse((Get-Date -UFormat %s))
$email = "testuser+$rand@example.com"
$password = 'Test1234!'
$name = 'PS Test User'

Write-Output "REGISTER -> $email"
$res = Invoke-WebRequest -Uri "$base/api/auth/register" -Method POST -Body (ConvertTo-Json @{name=$name;email=$email;password=$password}) -ContentType 'application/json' -WebSession $ws -UseBasicParsing -ErrorAction Stop
Write-Output "REGISTER Status: $($res.StatusCode)"
Write-Output "REGISTER Body: $($res.Content)"

# PATCH profile
$newName = "$name Updated"
Write-Output "PATCH /api/auth/me -> $newName"
$res = Invoke-WebRequest -Uri "$base/api/auth/me" -Method PATCH -Body (ConvertTo-Json @{name=$newName}) -ContentType 'application/json' -WebSession $ws -UseBasicParsing -ErrorAction Stop
Write-Output "PATCH Status: $($res.StatusCode)"
Write-Output "PATCH Body: $($res.Content)"

# Get current user
Write-Output "GET /api/auth/me"
$res = Invoke-WebRequest -Uri "$base/api/auth/me" -Method GET -WebSession $ws -UseBasicParsing -ErrorAction Stop
Write-Output "GET Status: $($res.StatusCode)"
Write-Output "GET Body: $($res.Content)"

# Change password
$newPassword = 'New' + $password
Write-Output "PATCH /api/auth/password -> change to $newPassword"
$res = Invoke-WebRequest -Uri "$base/api/auth/password" -Method PATCH -Body (ConvertTo-Json @{ currentPassword = $password; newPassword = $newPassword }) -ContentType 'application/json' -WebSession $ws -UseBasicParsing -ErrorAction Stop
Write-Output "PASSWORD PATCH Status: $($res.StatusCode)"
Write-Output "PASSWORD PATCH Body: $($res.Content)"

# Login with new password
Write-Output "POST /api/auth/login -> $email"
$res = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -Body (ConvertTo-Json @{ email = $email; password = $newPassword }) -ContentType 'application/json' -UseBasicParsing -ErrorAction Stop
Write-Output "LOGIN Status: $($res.StatusCode)"
Write-Output "LOGIN Body: $($res.Content)"

Write-Output 'PS TEST PASSED'