param(
  [Parameter(Mandatory=$true)]
  [string]$ProjectId,

  [Parameter(Mandatory=$true)]
  [string]$SecretName,

  [Parameter(Mandatory=$true)]
  [string]$ServiceAccountEmail,

  [Parameter(Mandatory=$true)]
  [string]$TokenFile
)

$ErrorActionPreference = 'Stop'

if (!(Test-Path $TokenFile)) {
  throw "Token file not found: $TokenFile"
}

Write-Host "Using project: $ProjectId" -ForegroundColor Cyan
Write-Host "Secret name:  $SecretName" -ForegroundColor Cyan
Write-Host "Granting to:  $ServiceAccountEmail" -ForegroundColor Cyan
Write-Host "Token file:   $TokenFile" -ForegroundColor Cyan

# Ensure project is set
& gcloud config set project $ProjectId | Out-Null

# Create secret if it doesn't exist
$exists = $false
try {
  & gcloud secrets describe $SecretName --project $ProjectId --format="value(name)" | Out-Null
  $exists = $true
} catch {
  $exists = $false
}

if (-not $exists) {
  Write-Host "Creating secret $SecretName..." -ForegroundColor Yellow
  & gcloud secrets create $SecretName --project $ProjectId --replication-policy="automatic" | Out-Null
} else {
  Write-Host "Secret $SecretName already exists." -ForegroundColor Green
}

Write-Host "Adding new secret version from file (token contents not printed)..." -ForegroundColor Yellow
& gcloud secrets versions add $SecretName --project $ProjectId --data-file=$TokenFile | Out-Null

Write-Host "Granting Secret Accessor role to service account..." -ForegroundColor Yellow
& gcloud secrets add-iam-policy-binding $SecretName --project $ProjectId `
  --member "serviceAccount:$ServiceAccountEmail" `
  --role "roles/secretmanager.secretAccessor" | Out-Null

Write-Host "Done." -ForegroundColor Green
