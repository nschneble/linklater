import Alert from '../common/Alert';
import { AUTHORIZE_FAILURE_MESSAGES } from './extensionAuthorizeMessages';
import ExtensionAuthorizeCard from './ExtensionAuthorizeCard';
import { useEffect, useRef } from 'react';

/**
 * What an arrival missing `code_challenge` or `redirect_uri` gets instead
 * of a consent prompt. The grant those parameters describe cannot be made,
 * and a screen that looks ready to work is worse than one that says so.
 *
 * Focus moves to the message because this branch renders no control at
 * all. `role="alert"` would announce it either way, so the move is not
 * what makes it heard; what it buys is a keyboard user having somewhere to
 * be other than `<body>`, and a Tab that starts from the explanation.
 */
export default function ExtensionRequestUnreadable() {
  const messageReference = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    messageReference.current?.focus();
  }, []);

  return (
    <ExtensionAuthorizeCard>
      <h1 className="mb-4 text-[var(--mount-text)] text-2xl font-bold">
        Can&rsquo;t authorize this extension
      </h1>
      <Alert
        ref={messageReference}
        icon="fa-triangle-exclamation"
        tabIndex={-1}
        variant="error"
      >
        {AUTHORIZE_FAILURE_MESSAGES['request-invalid']}
      </Alert>
    </ExtensionAuthorizeCard>
  );
}
