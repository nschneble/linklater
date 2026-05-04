# Verification

## After all changes:

```
npm run lint   # zero errors
npm run test   # all tests pass
npm run build  # both apps build clean

./flintest     # project's own check script
```

## Manual UI checklist:

- Modal backdrops dismiss consistently (LinkForm + KeyboardShortcutsModal)
- Toast shows dismiss button, animates out on close
- Arrow keys navigate tabs and user menu
- Typing fast in search bar fires only one request (check Network tab)
- Theme submenu preview switches at ~150ms, not 600ms
- "Load more" shows skeleton cards while loading
- Error boundary: throwing in a component shows fallback, not blank screen
- Registration sends verification email; unverified users see banner
- Forgot password flow sends reset email; reset link works and expires
- Rate limiting: > 5 rapid register attempts returns 429
- tsvector search: multi-word query matches title/description/URL
