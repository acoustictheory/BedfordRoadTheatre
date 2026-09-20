# Codemagic build access

Application: `BedfordRoadTheatre`, ID `6a9d6a214e81222fd90c7c45`.
Workflow: `bedford-ios-testflight`; branch: `master`.

The API token is stored outside Git at
`%LOCALAPPDATA%\BedfordRoadTheatre\codemagic-token.dpapi`.
It is encrypted using Windows DPAPI for the current Windows user. Do not print
the decrypted value or put it in Markdown, Git, logs, or build arguments.

Load credentials in PowerShell:

```powershell
$secure = Get-Content -LiteralPath (Join-Path $env:LOCALAPPDATA 'BedfordRoadTheatre\codemagic-token.dpapi') | ConvertTo-SecureString
$headers = @{'x-auth-token'=[System.Net.NetworkCredential]::new('', $secure).Password}
```

Check existing builds before queuing another:

```powershell
$result = Invoke-RestMethod -Uri 'https://api.codemagic.io/builds?appId=6a9d6a214e81222fd90c7c45' -Headers $headers
$result.builds | Select-Object -First 5 _id,status,branch,startedAt,finishedAt
```

Queue an authorized release after pushing the desired source:

```powershell
$body = @{appId='6a9d6a214e81222fd90c7c45'; workflowId='bedford-ios-testflight'; branch='master'} | ConvertTo-Json
$result = Invoke-RestMethod -Method Post -Uri 'https://api.codemagic.io/builds' -Headers $headers -ContentType 'application/json' -Body $body
$result.buildId
```

Do not automatically retry a timed-out POST: first check the build list to avoid
duplicate builds. Builds use hosted Mac minutes and the existing workflow
uploads successful releases to TestFlight, not the public App Store.

## Latest queued build

- Requested 2026-09-19 from `master` at `0d3cf3c` (application release `4f9153a`).
- Build ID: `6aaf33d31c7c27da103a38d2`.
- [Build dashboard](https://codemagic.io/app/6a9d6a214e81222fd90c7c45/build/6aaf33d31c7c27da103a38d2).
- API accepted the request; successful signing/upload and TestFlight processing
  still require verification. A queued build is not a published iOS release.

[API documentation](https://docs.codemagic.io/rest-api/builds/).
