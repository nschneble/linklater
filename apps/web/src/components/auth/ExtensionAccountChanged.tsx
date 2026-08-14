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
 * The statement and the instruction ride one region root, though they
 * stay separate nodes. The instruction is the only text telling the user
 * what to do about any of this, and reaching them through the button's
 * description does not reach them at all: a description is read when a
 * control takes focus, and the account changes while the control already
 * has it. A second live root inside the first would not help either,
 * since the politeness and atomic walks can stop at different elements
 * and the statement can then queue twice.
 *
 * The root leaves the flow while empty rather than hiding, because
 * `display: none` takes it out of the accessibility tree and a region
 * that is not in the tree cannot announce when it comes back. It cannot
 * use `display: contents` either: an element with no box discards the
 * margins the card's spacing hands it, so the gaps around this would
 * disappear. It cannot key off `:empty`, which does not match an element
 * holding element children, so the state is marked on the root instead.
 *
 * `aria-atomic` is written out even though `role="status"` implies it.
 * The atomic walk looks for an ancestor that has explicitly set the
 * attribute, and a role's implied default is not a value anyone set.
 * With one sentence that distinction is idle; with two it decides
 * whether the region reads as one utterance or as whichever half moved.
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
    <div
      data-testid="extension-account-changed-region"
      data-mismatched={mismatched || undefined}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="absolute data-mismatched:static space-y-4"
    >
      <p
        id="extension-account-changed"
        className="text-[var(--mount-text)] text-sm font-medium"
      >
        {mismatched && ACCOUNT_CHANGED_MESSAGE}
      </p>
      <p
        id="extension-account-changed-next"
        className="text-[var(--mount-alt-text)] text-xs"
      >
        {mismatched && ACCOUNT_CHANGED_NEXT_STEP}
      </p>
    </div>
  );
}
