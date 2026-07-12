import Alert from '../../common/Alert';
import CopyRevealPanel from '../../common/CopyRevealPanel';
import FormInput from '../../common/FormInput';
import IconButton from '../../common/IconButton';
import LinkButton from '../../common/LinkButton';
import PrimaryButton from '../../common/PrimaryButton';
import ApiTokensList from '../ApiTokensList';
import { useApiTokens } from './useApiTokens';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

/**
 * Settings section for managing personal access tokens (PATs).
 *
 * All state and API calls live in `useApiTokens`. This component renders the
 * create form, the newly-created token reveal panel, the token list, and
 * the API docs link.
 */
export default function ApiTokensSection() {
  const apiTokens = useApiTokens();

  return (
    <div className="max-w-md space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[var(--mount-text)] text-sm font-semibold text-balance">
          API Tokens
        </h3>
        {!apiTokens.showCreate && !apiTokens.newToken && (
          <IconButton onClick={() => apiTokens.setShowCreate(true)}>
            <i className="fa-solid fa-plus text-[0.7rem]" aria-hidden="true" />
            Generate new token
          </IconButton>
        )}
      </div>

      {apiTokens.loadError && (
        <Alert variant="error">{apiTokens.loadError}</Alert>
      )}

      {apiTokens.showCreate && (
        <form
          className="space-y-4 -mx-6 my-6 p-6 border-y border-[var(--mount-border)] border-dotted"
          onSubmit={(event: FormEvent) => void apiTokens.handleCreate(event)}
        >
          <label
            className="block mb-0 text-[var(--mount-alt-text)] text-xs font-medium"
            htmlFor="token-name"
          >
            New token name
          </label>
          <FormInput
            ref={apiTokens.nameInputReference}
            id="token-name"
            surface="mount"
            type="text"
            disabled={apiTokens.creating}
            placeholder="e.g. Claude, Twilio"
            onChange={(event) => apiTokens.setCreateName(event.target.value)}
            value={apiTokens.createName}
            maxLength={100}
            required
          />
          {apiTokens.createError && (
            <Alert variant="error">{apiTokens.createError}</Alert>
          )}
          <div className="flex gap-3">
            <PrimaryButton
              disabled={
                apiTokens.creating || apiTokens.createName.trim().length === 0
              }
            >
              <i
                className="fa-solid fa-plug-circle-plus text-[0.7rem]"
                aria-hidden="true"
              />
              {apiTokens.creating ? 'Creating…' : 'Create token'}
            </PrimaryButton>
            <LinkButton
              disabled={apiTokens.creating}
              onClick={() => {
                apiTokens.setShowCreate(false);
                apiTokens.setCreateName('');
                apiTokens.setCreateError(null);
              }}
            >
              Cancel
            </LinkButton>
          </div>
        </form>
      )}

      {apiTokens.newToken && (
        <CopyRevealPanel
          headingText="Your new token has been created."
          bodyText="It'll only be shown once, so make sure you copy it down before navigating away from this page!"
          secrets={[apiTokens.newToken.rawToken]}
          secretAriaLabel="Personal access token – navigate here to read it character by character"
          copiedAnnouncement="Token copied to clipboard"
          copied={apiTokens.copied}
          onCopy={apiTokens.handleCopy}
        />
      )}

      <ApiTokensList
        onRevoke={apiTokens.handleRevoke}
        tokens={apiTokens.tokens}
      />

      <Link
        className="group flex items-center gap-2 text-[var(--base-subtle-text)] hover:text-[var(--base-text)] text-sm transition duration-200"
        to="/docs"
      >
        View API docs
        <i
          className="fa-solid fa-arrow-right text-[var(--base-subtle-text)] group-hover:text-[var(--base-text)] text-[0.7rem]"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}
