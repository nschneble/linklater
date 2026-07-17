# 🪵 Changelog

**All notable project changes will be documented in this file.** The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Pride Versioning](https://pridever.org) → `PROUD.DEFAULT.SHAME`

## [Unreleased]

### Added

### Changed

### Fixed

## [1.0.2] - 2026-07-16

### Fixed

- CI API cert timeout causes Tuffgal to fail

### Fixed

- Add link form stays open after saving a link
- Bookmarklet fails on literally every page
- Button taps in the mobile user menu are ignored
- Logged-in users see marketing page with “Get started” and “Log in” buttons
- Mark unread button is left-aligned on link cards without descriptions
- “No un/read links” flashes before links are rendered
- Top margin on add link form is oversized on mobile
- Top margin on signup/login auth form is oversized on mobile
- Viewport overflows on mobile

## [1.0.0] - 2026-07-12

### Added

- Container infrastructure and a tag-push deploy workflow for single-VPS hosting
- Hosting and deployment decision record
- Password/MFA confirmation step to delete your account
- Rate limit on API token creation
- Reading suggestions on an empty links view
- Unauthenticated `/health` endpoint for orchestrators and deploy checks

### Changed

- `CORS_ORIGIN` now accepts a comma-separated list of origins
- Hide new API token if you immediately revoke it
- Show a success toast after regenerating the bookmarklet
- Stop underlining Font Awesome icons in CVD mode
- Stumble! now draws from a variety of sources

### Fixed

- Arrow key navigation gets stuck on the Themes menu
- Bookmarklet displays an error when you try to save a link
- Cannot click "Mark unread" on read link cards
- Last selected Settings section is restored after navigating away and back
- Magic link accounts can't use MFA
- Some changed settings may not be reflected until after a page refresh

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

[Unreleased]: https://github.com/nschneble/linklater/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/nschneble/linklater/compare/v1.0.0...v1.0.2
[1.0.0]: https://github.com/nschneble/linklater/releases/tag/v1.0.0
[0.3.0]: https://github.com/nschneble/linklater/releases/tag/v0.3.0
[0.2.0]: https://github.com/nschneble/linklater/releases/tag/v0.2.0
[0.1.0]: https://github.com/nschneble/linklater/releases/tag/v0.1.0
