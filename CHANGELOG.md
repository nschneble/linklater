# 🪵 Changelog

**All notable project changes will be documented in this file.** The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Pride Versioning](https://pridever.org) → `PROUD.DEFAULT.SHAME`

## [Unreleased]

### Added

#### Features

- Account security
  - Email verification
  - Google SSO
  - Magic link login
  - Multi-factor authentication
  - Password reset

- Added two new themes
  - "Apollo 10½" accessible theme
  - "Nouvelle Vague" noir theme

- Accessibility
  - Color Vision Deficiency (CVD) mode
  - Full keyboard navigation
  - Keyboard shortcuts

- Bookmarklet
  - Bookmarklet no longer expires
  - Added regenerate option to invalidated old bookmarklet

- New pages
  - API documentation
  - Marketing / landing page
  - "Stumble!" page

#### Bugfixes

- Added a bunch of missing accessibility tags
- Fixed the frankly unusable layout on mobile devices
- The user menu now closes properly when the keyboard shortcuts modal is opened

### Known Issues

- Arrow key navigation on the user menu gets stuck on the "Themes" menu item
- Bookmarklet currently displays an error when you try to save a link
- Cannot click "Mark unread" on read link cards
- If you revoke a brand new API token, the copy-to-clipboard section is still visible
- Some changed settings may not be reflected until the page is refreshed
- Theme and mode may periodically get reset

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
- Search and [Stumble!](https://en.wikipedia.org/wiki/StumbleUpon)
- Toggle themes based on Richard Linklater's filmography
- Toggle light and dark mode

#### Bugfixes

_None_

[Unreleased]: https://github.com/nschneble/linklater/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/nschneble/linklater/releases/tag/v0.2.0
[0.1.0]: https://github.com/nschneble/linklater/releases/tag/v0.1.0
