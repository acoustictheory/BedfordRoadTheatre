param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Za-z0-9._-]{3,40}$')]
  [string]$Username
)

$normalizedUsername = $Username.Trim().ToLowerInvariant()
$loginIdentifier = "$normalizedUsername@users.bedford-musical.invalid"
$securePassword = Read-Host "Current portal password for $Username" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $requestBody = @{
    email = $loginIdentifier
    password = $plainPassword
    returnSecureToken = $true
  } | ConvertTo-Json

  try {
    $response = Invoke-RestMethod `
      -Method Post `
      -Uri 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyCj9z5BuDIWW0JcuK2k7EwiWpe8xRI4vRY' `
      -ContentType 'application/json' `
      -Body $requestBody

    if ($response.email -eq $loginIdentifier -and $response.localId) {
      Write-Host "SUCCESS: The current password migrated correctly for $Username." -ForegroundColor Green
    } else {
      Write-Host 'FAILED: Firebase returned an unexpected account.' -ForegroundColor Red
      exit 1
    }
  } catch {
    $message = $_.ErrorDetails.Message
    if ($message -match 'INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD') {
      Write-Host 'FAILED: Firebase did not accept the current password.' -ForegroundColor Red
    } else {
      Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
  }
} finally {
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  Remove-Variable plainPassword, requestBody, response, securePassword -ErrorAction SilentlyContinue
}
