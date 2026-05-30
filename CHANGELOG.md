# 🪵 Changelog

**All notable project changes will be documented in this file.** The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Pride Versioning](https://pridever.org) → `PROUD.DEFAULT.SHAME`

## Known Issues

- Arrow key navigation on the user menu gets stuck on the "Themes" menu item
- Bookmarklet currently displays an error when you try to save a link
- Cannot click "Mark unread" on read link cards
- If you revoke a brand new API token, the copy-token section is still visible
- Some changed settings may not be reflected until the page is refreshed
- Theme and mode may periodically get reset

## [Unreleased]

### Added

_Nothing new yet_

### Fixed

_Nothing new yet_

## [0.3.0] - 2026-05-30

### Added

#### Accessibility

- Color Vision Deficiency (CVD) mode
- Full keyboard navigation
- Keyboard shortcuts

#### Account security

- Email verification
- Google SSO
- Magic link login
- Multi-factor authentication
- Password reset

#### Pages

- API documentation
- Marketing / landing page
- "Stumble!" page

#### Themes

- "Apollo 10½" accessible theme
- "Nouvelle Vague" noir theme

### Changed

#### Bookmarklet

- Bookmarklet no longer expires
- Added regenerate option to invalidated the old bookmarklet

### Fixed

- Added a bunch of missing accessibility tags
- Fixed the (frankly unusable) layout on mobile devices
- User menu now closes when the shortcuts modal opens

## [0.2.0] - 2026-04-21

### Changed

This is a development version bump. Most of the changes are related to refactoring and reorganizing files in the repository.

## [0.1.0] - 2026-04-20

### Added

**TL;DR:** Literally ✨everything✨

#### Features

- Create and delete accounts
- Save links in-app or using the bookmarklet
- Search and [Stumble!](https://en.wikipedia.org/wiki/StumbleUpon)
- Toggle themes based on Richard Linklater's filmography
- Toggle light and dark mode

[Unreleased]: https://github.com/nschneble/linklater/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/nschneble/linklater/releases/tag/v0.3.0
[0.2.0]: https://github.com/nschneble/linklater/releases/tag/v0.2.0
[0.1.0]: https://github.com/nschneble/linklater/releases/tag/v0.1.0
