# 🪵 Changelog

**All notable project changes will be documented in this file.** The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Pride Versioning](https://pridever.org) → `PROUD.DEFAULT.SHAME`

## [Unreleased]

### Added

#### Features

- bookmarklet token no longer expires; revocable via Regenerate button in
  Settings — old installs stop working immediately on regeneration
- cancellable TOTP enrollment — users can abort in-flight MFA setup from
  both the QR-scan step and the "Continue setup" recovery state; cancelling
  clears the pending secret server-side so no orphaned secrets remain
- API documentation page (`/settings/api`)
  - interactive Scalar reference embed, served from `/openapi.json`
  - sessionStorage-scoped PAT field — token never leaves the tab, never
    hits the URL bar
  - dark mode follows the active Linklater theme with no flash-of-unstyled-
    content; Scalar's own toggle is hidden
  - keyboard skip link around the Scalar embed
  - reduced-motion CSS injected into the Scalar scope
  - discovery link added to Settings → API Tokens
- account security
  - email verification
  - password reset
  - Google SSO
  - multi-factor authentication
  - magic link login
- accessibility
  - full keyboard navigation
  - keyboard shortcuts
  - CVD mode toggle in Settings
  - "Apollo 10½" accessible theme
- full-text search
- marketing / landing page
- "Nouvelle Vague" noir theme
- "Stumble!" page

#### Bugfixes

- added missing accessibility tags
- fixed unusable layout on mobile devices
- user menu now closes when keyboard shortcuts modal opens

### Removed

#### Features

_Nothing here!_

## [0.2.0] - 2026-04-21

### Added

This is a development version bump. Most of the changes are related to refactoring and reorganizing files in the repository.

#### Features

_None_

#### Bugfixes

_None_

## [0.1.0] - 2026-04-20

### Added

**TL;DR:** Literally ✨everything✨

#### Features

- Create and delete accounts
- Save links in-app or using the bookmarklet
- Search and [StumbleUpon](https://en.wikipedia.org/wiki/StumbleUpon)
- Toggle themes based on Richard Linklater's filmography
- Toggle light and dark mode

#### Bugfixes

_None_

[Unreleased]: https://github.com/nschneble/linklater/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/nschneble/linklater/releases/tag/v0.2.0
[0.1.0]: https://github.com/nschneble/linklater/releases/tag/v0.1.0
