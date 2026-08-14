import { accountIsVouchedFor } from './grantIdentity';
import Alert from '../common/Alert';
import { AUTHORIZE_FAILURE_MESSAGES } from './extensionAuthorizeMessages';
import ExtensionAccountChanged from './ExtensionAccountChanged';
import ExtensionAuthorizeCard from './ExtensionAuthorizeCard';
import { extensionDenialUrl } from './extensionDenialUrl';
import ExtensionRequestUnreadable from './ExtensionRequestUnreadable';
import { iconActionClasses } from '../common/IconButton';
import PrimaryButton, { primaryActionClasses } from '../common/PrimaryButton';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useExtensionAuthorize } from './useExtensionAuthorize';
import { useSearchParams } from 'react-router';

/**
 * Handles the `/extension/authorize` route for the browser extension PKCE
 * flow.
 *
 * The extension opens this page (via `chrome.identity.launchWebAuthFlow`
 * or a new tab) with `?code_challenge=<PKCE>&redirect_uri=<extension-uri>`.
 * An authenticated user sees a consent prompt; approving posts the grant
 * through `apiFetch`, which is the only way the session JWT reaches the
 * endpoint, and the page then navigates to the callback URL the server
 * hands back. Whether the extension may be redirected to at all is the
 * server's answer, not this page's.
 *
 * The account it names and the account it grants on are the same one, or
 * it grants on nothing, and the grant carries the very token that answer
 * was read off. Nothing re-hydrates this route, so the check is
 * page-local: `grantIdentity` reads it and `useExtensionAuthorize` acts
 * on it. What arrives here is a boolean that closes the identity line,
 * marks the control, and fills a region of its own, since a standing
 * precondition and a server's verdict are not the same message and must
 * not share a node.
 *
 * Failures speak through a single always-mounted `Alert`, which carries
 * `role="alert"` while it is still empty, so the region is in the tree
 * ahead of the text rather than arriving with it. Deliberately not the
 * hidden-paint-plus-sr-only-mirror shape `AlreadySignedInNotice` and
 * `PendingNoticeAnnouncer` use: those notices are inert and spoken once,
 * whereas an error is consultable, and an `aria-hidden` error is absent
 * from the page for exactly the people who cannot glance back at it.
 * `LoginRegisterView` is the pattern to follow here.
 *
 * Nothing announces on success. A live region mutating in the same tick as
 * a top-level navigation is not reliably spoken before the document is
 * torn down, so prescribing one would be prescribing dead code.
 */
export default function ExtensionAuthorizePage() {
  const { user } = useAuth();
  const [searchParameters] = useSearchParams();

  useDocumentTitle('Linklater – Authorize extension');

  const codeChallenge = searchParameters.get('code_challenge') ?? '';
  const redirectUri = searchParameters.get('redirect_uri') ?? '';

  const { authorizing, failure, handleAuthorize, mismatched } =
    useExtensionAuthorize(codeChallenge, redirectUri, user?.userId ?? null);

  if (!codeChallenge || !redirectUri) return <ExtensionRequestUnreadable />;

  if (!user) {
    return (
      <ExtensionAuthorizeCard>
        <h1 className="mb-2 text-[var(--mount-text)] text-2xl font-bold">
          Sign in to authorize
        </h1>
        <p className="mb-6 text-[var(--mount-alt-text)] text-sm">
          Sign in to your Linklater account to authorize the extension.
        </p>
        <a className={primaryActionClasses()} href="/login">
          Sign in
        </a>
      </ExtensionAuthorizeCard>
    );
  }

  return (
    <ExtensionAuthorizeCard className="space-y-4">
      <h1 className="text-[var(--mount-text)] text-2xl font-bold">
        Authorize Linklater Extension?
      </h1>
      {/* only states that still vouch for it may name the account */}
      {accountIsVouchedFor(failure, mismatched) && (
        <p className="text-[var(--mount-alt-text)] text-sm">
          Signed in as{' '}
          <span className="text-[var(--mount-text)] font-medium">
            {user.email}
          </span>
        </p>
      )}
      <ExtensionAccountChanged mismatched={mismatched} />
      <p className="text-[var(--mount-alt-text)] text-xs">
        The extension will be able to save and manage your links.
      </p>

      <p
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="extension-authorize-pending"
      >
        {authorizing ? 'Authorizing…' : ''}
      </p>
      {/* ahead of the pair so the explanation precedes the control */}
      <Alert
        id="extension-authorize-error"
        icon="fa-triangle-exclamation"
        variant="error"
      >
        {failure && AUTHORIZE_FAILURE_MESSAGES[failure]}
      </Alert>

      <div className="flex gap-3 justify-center">
        <PrimaryButton
          type="button"
          className="aria-disabled:active:scale-100 aria-disabled:cursor-not-allowed"
          onClick={() => void handleAuthorize()}
          aria-disabled={authorizing || mismatched}
          aria-describedby="extension-account-changed extension-account-changed-next extension-authorize-error"
        >
          {authorizing ? 'Authorizing…' : 'Authorize'}
        </PrimaryButton>
        {/* an anchor: declining is a navigation, per primaryActionClasses */}
        <a
          className={iconActionClasses('elevated')}
          href={extensionDenialUrl(redirectUri)}
        >
          Cancel
        </a>
      </div>
    </ExtensionAuthorizeCard>
  );
}
