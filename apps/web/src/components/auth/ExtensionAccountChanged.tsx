/**
 * What the consent screen says once the token behind it stopped
 * belonging to the account on screen.
 *
 * Its own region rather than the page's `Alert`, for three things the
 * error channel cannot give up. The click handler empties the failure at
 * the start of every attempt, and a precondition a click can erase is
 * not a precondition. The identity line is decided from the same union,
 * so a fourth member would leave the wrong address painted. And the
 * union feeds one assertive node, which would force an interruption on a
 * message the user never asked for.
 *
 * Polite for the reason `noticeCatalog` gives its warning variant: the
 * assertive channel is for a verdict the user is waiting on, and nobody
 * is waiting on a sibling tab. The wording keeps "signed in" to match
 * the four other places this route says it; the "Log in" rule belongs to
 * the login screen, whose control is labelled that way.
 *
 * The statement and the instruction are siblings rather than one node,
 * so the live region carries the state and not the errand. Both stay
 * mounted while empty, since a region born populated in a single commit
 * is the shape screen readers miss, and both leave the flow while they
 * are empty so the card keeps its spacing.
 *
 * Nothing here moves focus. 3.2.1 governs focus as a trigger rather than
 * an effect, 4.1.3 asks that the message land without one, and the place
 * the user was reading is worth more than either.
 */

interface ExtensionAccountChangedProps {
  mismatched: boolean;
}

const ACCOUNT_CHANGED_MESSAGE =
  'This tab is now signed in to a different account.';

const ACCOUNT_CHANGED_NEXT_STEP =
  'Close this tab and start again from the extension.';

export default function ExtensionAccountChanged({
  mismatched,
}: ExtensionAccountChangedProps) {
  return (
    <>
      <p
        id="extension-account-changed"
        role="status"
        aria-live="polite"
        className="empty:absolute text-[var(--mount-text)] text-sm font-medium"
      >
        {mismatched && ACCOUNT_CHANGED_MESSAGE}
      </p>
      <p
        id="extension-account-changed-next"
        className="empty:absolute text-[var(--mount-alt-text)] text-xs"
      >
        {mismatched && ACCOUNT_CHANGED_NEXT_STEP}
      </p>
    </>
  );
}
