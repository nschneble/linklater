# Project TODOs

This is a list of upcoming features, planned refactoring, and bugfixes.

## Features

- Improve account security
  - Add OAuth2 support to login with Google, GitHub, etc.
  - Add 2FA (Twilio SMS?)
- Create Chrome browser extension
  - https://developer.chrome.com/docs/extensions/get-started/
- Create Safari web extension for macOS
  - https://developer.apple.com/documentation/safariservices/creating-a-safari-web-extension
- Create Safari web extension for iOS
  - https://developer.apple.com/videos/play/tech-talks/110148/
- Introduce paid Stripe subscriptions
  - US$5 monthly and US$48 yearly plans
  - 7-day free trial
  - free plan: 3 unread links, 1 theme (A Scanner Darkly)
  - paid plan: Unlimited unread links, all themes

## Refactoring

- regenerate preview and all screenshots
- analyze/improve code coverage

## Bugfixes

_Bugs will be added here as they are reported or discovered_

## Verifications

- Toast notifications have a dismiss button and animate on close
- You can use arrow keys to navigate the tabs and user menu
- Searches are performed on a delay (check Network tab)
- Sped up theme submenu previews
- Loading more links shows the skeleton cards while loading
- Rate limiting will trigger after 5 rapid registration attempts
- Signup flow includes email verification
- Forgot password flow sends expiring reset email
- Enhanced search matches titles, descriptions, and urls
