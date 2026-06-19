import CopyRevealPanel from '../common/CopyRevealPanel';

interface RecoveryCodesPanelProps {
  /** The list of plaintext recovery codes to display and offer for copy. */
  codes: string[];
}

/**
 * Inline reveal panel shown immediately after MFA enrollment or recovery-code
 * regeneration. Wraps `CopyRevealPanel` with `focusOnMount` so the heading
 * announces on mount and Tab moves naturally to the copy button.
 *
 * Not a dialog – renders inline within the Security section so the user can
 * still scroll and read surrounding context.
 */
export default function RecoveryCodesPanel({ codes }: RecoveryCodesPanelProps) {
  return (
    <CopyRevealPanel
      headingText="Your recovery codes have been generated."
      bodyText="Each code can be used once to log in without the authenticator app. They'll only be shown here, so make sure you copy them down before navigating away from this page!"
      secrets={codes}
      secretAriaLabel="Recovery code – navigate here to read it character by character"
      copyButtonLabel="Copy all recovery codes to clipboard"
      copiedAnnouncement="Recovery codes copied to clipboard"
      focusOnMount
    />
  );
}
