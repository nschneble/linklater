# Deploy Checklist

This is a list of steps to follow when deploying to production.

## Google SSO (if enabled)

### Google Cloud Platform

- add production redirect URI (e.g. https://yourdomain.com/auth/google/callback)
- publish the app (removes testing restrictions)

### Linklater API

- set GOOGLE_CALLBACK_URL (e.g. https://yourdomain.com/auth/google/callback)
- set APP_URL (e.g. https://yourdomain.com)

### Linklater Web

- set VITE_API_BASE_URL (e.g. https://api.yourdomain.com)
- set VITE_GOOGLE_SSO_ENABLED to "true"

No need to remove the GCP dev credentials; localhost URIs just won't work
in production. You can use the same GCP project with both URIs registered,
or create a separate "Linklater Prod" OAuth client under the same project.
