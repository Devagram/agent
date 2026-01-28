# .secrets (local only)

This folder is for **local development only**.

## Service account key (Option B)

1. Copy `sitegen-agent-key.json.template` to `sitegen-agent-key.json`.
2. Paste the **Google service account JSON** contents into `sitegen-agent-key.json`.
3. Ensure `docker-compose.adk.yml` has the Option B volume mount uncommented:

```yaml
- ./.secrets/sitegen-agent-key.json:/var/secrets/google/service-account.json:ro
```

## Security

- Never commit `sitegen-agent-key.json`.
- Prefer ADC (Option A) on Cloud Run (no key file) and for local dev when possible.
