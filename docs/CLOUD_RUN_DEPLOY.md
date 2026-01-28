# Cloud Run Deployment Guide

This guide walks through deploying the `sitegen-agent` to Cloud Run with GitHub authentication for private skeleton repo access.

## Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated
- GitHub personal access token (fine-grained) with read access to `sitegen-skeleton`
- Both `sitegen-skeleton` and `sitegen-agent` repos pushed to GitHub

## Step 1: Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Click "Generate new token"
3. Configure:
   - **Token name**: `sitegen-agent-readonly`
   - **Expiration**: 90 days (set a reminder to rotate)
   - **Repository access**: Only select repositories → `sitegen-skeleton`
   - **Permissions**:
     - Repository permissions → Contents → Read-only
4. Generate and copy the token (you'll only see it once)

## Step 2: Store Token in Secret Manager

Replace `<YOUR_PROJECT_ID>` with your Google Cloud project ID.

```powershell
# Set your project
gcloud config set project <YOUR_PROJECT_ID>

# Enable Secret Manager API (if not already enabled)
gcloud services enable secretmanager.googleapis.com

# Create the secret (you'll be prompted to paste the token)
# Or use PowerShell variable:
$TOKEN = "ghp_your_token_here"
echo $TOKEN | gcloud secrets create github-readonly-token --data-file=-

# Verify the secret was created
gcloud secrets list
```

## Step 3: Grant Cloud Run Service Account Access to Secret

```powershell
# Get your project number
$PROJECT_NUMBER = (gcloud projects describe <YOUR_PROJECT_ID> --format="value(projectNumber)")

# The default Cloud Run service account
$SERVICE_ACCOUNT = "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant access to the secret
gcloud secrets add-iam-policy-binding github-readonly-token `
  --member="serviceAccount:${SERVICE_ACCOUNT}" `
  --role="roles/secretmanager.secretAccessor"
```

## Step 4: Build and Deploy to Cloud Run

Replace placeholders:
- `<YOUR_PROJECT_ID>`: Your Google Cloud project ID
- `<YOUR_GITHUB_USERNAME>`: Your GitHub username
- `<REGION>`: e.g., `us-central1`

```powershell
# Set variables
$PROJECT_ID = "<YOUR_PROJECT_ID>"
$REGION = "us-central1"
$GITHUB_USERNAME = "<YOUR_GITHUB_USERNAME>"

# Build the container image
gcloud builds submit --tag gcr.io/${PROJECT_ID}/sitegen-agent

# Deploy to Cloud Run
gcloud run deploy sitegen-agent `
  --image gcr.io/${PROJECT_ID}/sitegen-agent `
  --platform managed `
  --region $REGION `
  --allow-unauthenticated `
  --set-env-vars "SITEGEN_SKELETON_GIT_URL=https://github.com/${GITHUB_USERNAME}/sitegen-skeleton.git,SITEGEN_SKELETON_REF=main,GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" `
  --set-secrets "GITHUB_TOKEN=github-readonly-token:latest" `
  --memory 2Gi `
  --timeout 600 `
  --max-instances 10
```

### Alternative: Using `gcloud run services update` for existing service

```powershell
gcloud run services update sitegen-agent `
  --region $REGION `
  --set-env-vars "SITEGEN_SKELETON_GIT_URL=https://github.com/${GITHUB_USERNAME}/sitegen-skeleton.git,SITEGEN_SKELETON_REF=main" `
  --set-secrets "GITHUB_TOKEN=github-readonly-token:latest"
```

## Step 5: Verify Deployment

```powershell
# Get the service URL
$SERVICE_URL = (gcloud run services describe sitegen-agent --region $REGION --format="value(status.url)")

# Test health endpoint
curl.exe "${SERVICE_URL}/healthz"

# Expected response: {"ok":true}
```

## Step 6: Test End-to-End with /generate_preview

Create a test request:

```powershell
# Create test request payload
$testPayload = @{
  projectName = "test-site"
  firebaseProjectId = $PROJECT_ID
  pagePlanJson = @{
    meta = @{
      businessName = "Test Business"
      tagline = "Testing the pipeline"
    }
    sections = @()
  }
} | ConvertTo-Json -Depth 10

# Save to file
$testPayload | Set-Content -Encoding utf8 -NoNewline test-request.json

# Send request
curl.exe -X POST "${SERVICE_URL}/generate_preview" `
  -H "Content-Type: application/json" `
  --data-binary "@test-request.json"
```

Expected response:
```json
{
  "previewUrl": "https://test-site-20260127--<project>.web.app",
  "channelId": "test-site-20260127"
}
```

## Troubleshooting

### Secret not found
```powershell
# List secrets
gcloud secrets list

# View secret details
gcloud secrets describe github-readonly-token
```

### Service account permissions
```powershell
# Verify IAM binding
gcloud secrets get-iam-policy github-readonly-token
```

### View Cloud Run logs
```powershell
gcloud run services logs read sitegen-agent --region $REGION --limit 50
```

### Test git clone locally (without Cloud Run)
```powershell
$env:SITEGEN_SKELETON_GIT_URL = "https://github.com/${GITHUB_USERNAME}/sitegen-skeleton.git"
$env:SITEGEN_SKELETON_REF = "main"
$env:GITHUB_TOKEN = "ghp_your_token_here"

# Run agent locally with Docker
docker-compose -f docker-compose.adk.yml up
```

## Security Notes

1. **Token rotation**: Set a calendar reminder to rotate the GitHub token before expiration
2. **Least privilege**: The token has read-only access to only the skeleton repo
3. **Secret versioning**: Secret Manager keeps version history; you can roll back if needed
4. **Audit logs**: Enable Cloud Audit Logs to track secret access

## Cost Optimization

- Cloud Run charges only for request processing time
- Shallow git clone (`--depth 1`) minimizes clone time/bandwidth
- Consider increasing memory if builds are slow (tradeoff: speed vs cost)
- Set `--max-instances` to limit concurrent spending

## Next Steps

- Set up monitoring/alerting for service health
- Configure custom domain if needed
- Add authentication if the service should be private
- Set up CI/CD for automated agent deployments
