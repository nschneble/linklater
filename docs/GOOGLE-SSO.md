# Enabling Google Sign-In in production

Linklater ships with Google Sign-In fully built: sign-in, account creation,
and linking Google to an existing account. It is **off until configured**,
because it needs credentials only you can create. This guide takes you from a
running production stack (see [DEPLOYMENT.md](./DEPLOYMENT.md)) to a working
"Continue with Google" button.

There are three sides to wire, and all three must line up:

1. **Google Cloud Console** — an OAuth client, plus the exact redirect URLs
   Google is allowed to send users back to.
2. **The API** — the client credentials and callback URLs, supplied as
   production environment variables.
3. **The web build** — a build-time flag that renders the button. It is baked
   into the static bundle, so it takes a rebuild, not just a restart.

Miss any one and the flow fails in a specific, diagnosable way; the
[Troubleshooting](#troubleshooting) table maps each symptom back to its side.

## Prerequisites

- The production stack is deployed and reachable at your domain over HTTPS
  (Caddy terminates TLS; see DEPLOYMENT.md). Google refuses non-HTTPS redirect
  URIs for anything but `localhost`, so a working certificate is a hard
  requirement, not a nicety.
- You can edit the `PRODUCTION_ENV` GitHub Actions secret and repository
  variables (Settings → Secrets and variables → Actions).

## 1. Create the OAuth client in Google Cloud Console

1. Open the [Google Cloud Console](https://console.cloud.google.com), and
   create a project (or reuse one).
2. Configure the **OAuth consent screen** (APIs & Services → OAuth consent
   screen):
   - User type **External**.
   - Fill in the app name, a support email, and the required app-homepage,
     privacy-policy, and terms links. Your `https://YOUR_DOMAIN` and
     `https://YOUR_DOMAIN/privacy` pages satisfy these.
   - Add the scopes `.../auth/userinfo.email`, `.../auth/userinfo.profile`,
     and `openid`. These are Google's **non-sensitive** scopes, so the app
     does not need Google's security assessment to function.
   - Set the publishing status to **In production**. While an app is in
     **Testing** it only admits accounts you list as test users (capped at 100) and issues short-lived refresh tokens, which is fine for a trial but
     not for real users. Publishing an app that requests only these
     non-sensitive scopes does not trigger a verification review; you may see
     an "unverified app" notice on the consent screen until you complete
     branding verification, which is cosmetic and does not block sign-in.
3. Create the credentials (APIs & Services → Credentials → Create credentials →
   **OAuth client ID**):
   - Application type **Web application**.
   - Under **Authorized redirect URIs**, add **both** of these, exactly:

     ```txt
     https://YOUR_DOMAIN/api/auth/google/callback
     https://YOUR_DOMAIN/api/auth/google/link/callback
     ```

     The `/api` prefix matters because the production web build talks to the
     API under `/api`, which Caddy strips before proxying (`Caddyfile`); the
     browser-facing callback carries it too, while local dev reaches the API
     directly at `:3000` and stays unprefixed.

     Both are required: the first is the sign-in flow, the second is the
     "link Google to my account" flow in Settings. They are handled by two
     separate strategies with two separate callback environment variables
     (`apps/api/src/auth/google.strategy.ts` and `google-link.strategy.ts`),
     so registering only one leaves the other flow broken.

     Google matches redirect URIs **exactly** — scheme, host, path, and
     trailing slash all count. `https://YOUR_DOMAIN/api/auth/google/callback/`
     (trailing slash) is a different URI and will be rejected with
     `redirect_uri_mismatch`. Copy the paths above verbatim.
4. Copy the generated **Client ID** and **Client secret**. The secret is shown
   once; store it in your password manager.

## 2. Set the API environment variables

Add these to the `PRODUCTION_ENV` secret (the newline-separated `KEY=value`
list the deploy workflow writes to `production.env`; see DEPLOYMENT.md →
Required human actions). The compose file already forwards them to the API
container (`docker-compose.prod.yml`), so no other change is needed.

| Variable                   | Value                                               | Notes                                                |
| -------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `GOOGLE_CLIENT_ID`         | the client ID from step 1                           | Required for both sign-in and linking.               |
| `GOOGLE_CLIENT_SECRET`     | the client secret from step 1                       | Required for both sign-in and linking.               |
| `GOOGLE_CALLBACK_URL`      | `https://YOUR_DOMAIN/api/auth/google/callback`      | Enables the sign-in strategy.                        |
| `GOOGLE_LINK_CALLBACK_URL` | `https://YOUR_DOMAIN/api/auth/google/link/callback` | Enables the account-linking strategy.                |
| `APP_URL`                  | `https://YOUR_DOMAIN`                               | Already required; the redirect origin after sign-in. |

Three behaviours worth knowing before you deploy:

- **The provider is all-or-nothing per flow.** The API registers the Google
  sign-in strategy only when `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
  `GOOGLE_CALLBACK_URL` are all present, and the linking strategy only when
  the first two plus `GOOGLE_LINK_CALLBACK_URL` are present
  (`apps/api/src/auth/auth.module.ts`). A missing or misspelled value does not
  error at startup; it silently disables that flow. The route still exists (the
  controller is always mounted), so a click reaches a route with no strategy
  behind it and fails with a `500` (`Unknown authentication strategy`).
- **The callback values must byte-match Google.** `GOOGLE_CALLBACK_URL` and
  `GOOGLE_LINK_CALLBACK_URL` are sent to Google as the `redirect_uri`, so they
  have to equal the URIs you registered in step 1 exactly.
- **`APP_URL` is where the browser lands after sign-in.** The callback handler
  redirects to `${APP_URL}/oauth/callback#...` with the session tokens in the
  URL fragment (`apps/api/src/auth/oauth.controller.ts`). Point it at the
  public origin; a stale `localhost` value sends users nowhere.

You do not need to touch cookie or CSRF settings. The OAuth anti-CSRF state
cookie is issued `Secure` + `SameSite=None` unconditionally
(`apps/api/src/auth/oauth-state-cookie.ts`), which is exactly what a
TLS-terminated production deployment needs; there is no `NODE_ENV`-gated flag
to remember to flip.

## 3. Enable the button in the web build

The login page renders the Google button only when `VITE_GOOGLE_SSO_ENABLED`
is `'true'` (`apps/web/src/components/auth/LoginRegisterView.tsx`). Vite reads
`import.meta.env.VITE_GOOGLE_SSO_ENABLED` **at build time** and bakes the
result into the static bundle, so this is not a runtime environment variable
you can set on the container — it has to be present when the web image is
built.

The deploy workflow passes it through as a Docker build argument sourced from a
repository variable, so you flip it on without touching code:

1. Set the repository **variable** (not a secret — it is not sensitive)
   `ENABLE_GOOGLE_SSO` to `true` (Settings → Secrets and variables →
   Actions → Variables).
2. Cut a release (push a `vX.Y.Z` tag). CI rebuilds the web image with the
   button enabled and rolls it out. Setting the variable alone does nothing
   until the next build, because the current image was already baked without
   it.

If the variable is unset the build defaults to `false` (the button stays
hidden), so this is safe to leave off until you have finished steps 1 and 2.

## 4. Deploy and verify

1. Save the `PRODUCTION_ENV` secret from step 2 and the repository variable
   from step 3.
2. Cut a version tag to trigger a deploy. This picks up the new API
   environment and rebuilds the web image in one release.
3. Verify end to end:
   - Visit `https://YOUR_DOMAIN/login` and confirm **Continue with Google**
     appears.
   - Complete a sign-in. You should return to the app authenticated.
   - From **Settings**, link and then unlink a Google account to confirm the
     second redirect URI works.

## Troubleshooting

| Symptom                                            | Cause                                                               | Fix                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| No "Continue with Google" button on the login page | `ENABLE_GOOGLE_SSO` was not `true` when the web image was built     | Set the repo variable, then rebuild (cut a new tag). See step 3.                                 |
| Button appears, but `/auth/google` returns a `500` | The API strategy is not registered (a `GOOGLE_*` var is missing)    | Recheck all four API variables in `PRODUCTION_ENV`. See step 2.                                  |
| Google shows `Error 400: redirect_uri_mismatch`    | The registered redirect URI does not exactly match the callback var | Make the Google Console URI and the callback var byte-identical (no trailing slash). See step 1. |
| Sign-in succeeds but the app never loads afterward | `APP_URL` is unset or points at `localhost`                         | Set `APP_URL` to the public origin. See step 2.                                                  |
| Only allow-listed accounts can sign in             | The consent screen is still in **Testing**                          | Publish the consent screen to **In production**. See step 1.                                     |

## Dev and prod on one client

You can keep both the local `https://localhost:3000/...` redirect URIs and the
production ones registered on a single OAuth client, or create a separate
"Linklater (production)" client. A separate client keeps the production secret
out of local dev config, at the cost of managing two sets of credentials.
Either works; the app only ever knows the callback URLs you hand it.

## Sources

Google's flows change; verify against the current console when in doubt.

- [Using OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
  — Web-application client type and the exact-match redirect URI rule.
- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes)
  — scope classification (`userinfo.email`, `userinfo.profile`, `openid`).
- [Setting up your OAuth consent screen](https://support.google.com/cloud/answer/10311615)
  — Testing vs. In production publishing status and verification triggers.
