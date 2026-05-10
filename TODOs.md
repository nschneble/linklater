# Project TODOs

This is a list of upcoming features, planned refactoring, and bugfixes.

## Features

- Add 2FA
  - Use Twilio SMS (?)
- Create Chrome browser extension
  - https://developer.chrome.com/docs/extensions/get-started/
- Create Safari web extension for macOS
  - https://developer.apple.com/documentation/safariservices/creating-a-safari-web-extension
- Create Safari web extension for iOS
  - https://developer.apple.com/videos/play/tech-talks/110148/
- Introduce paid Stripe subscriptions
  - US$5 monthly and US$48 yearly plans
  - 7-day free trial
  - Paid plan: customize themes and keyboard shortcuts
  - Paid plan: no ads, configure read link and stumble upon functionality
  - Paid plan: share new links automatically with other users

## Refactoring

- Break up apps/web/src/lib/api.ts by core/token, user, and link endpoints
- Ensure royalty-free assets for any Richard Linklater images
- Fully remap "active" to "unread" and "archived" to "read"
- Review ./dev and ./flintest scripts
- Review all api DTOs + specs
- Review all apps/web/src/components + tests with a fine-toothed comb
- Verify: Forgot password flow sends expiring reset email
- Verify: You can use arrow keys to navigate the tabs and user menu

## Bugfixes

- Page may not refresh automatically after email verification (still showing banner)
- Theme editor reset button works inconsistently
