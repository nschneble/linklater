import Alert from '../../common/Alert';
import FormInput from '../../common/FormInput';
import IconButton from '../../common/IconButton';
import LinkButton from '../../common/LinkButton';
import PrimaryButton from '../../common/PrimaryButton';
import ApiTokensList from '../ApiTokensList';
import { useNavigate } from 'react-router-dom';
import { useApiTokens } from './useApiTokens';
import type { FormEvent } from 'react';

/**
 * Settings section for managing personal access tokens (PATs).
 *
 * All state and API calls live in `useApiTokens`. This component renders the
 * create form, the newly-created token reveal panel, the token list, and
 * the API docs link.
 */
export default function ApiTokensSection() {
  const navigate = useNavigate();
  const apiTokens = useApiTokens();

  return (
    <div className="max-w-md space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[var(--text)] text-sm font-semibold text-balance">
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
          className="space-y-4 -mx-6 my-6 p-6 border-y border-[var(--border)] border-dotted"
          onSubmit={(event: FormEvent) => void apiTokens.handleCreate(event)}
        >
          <label
            className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
            htmlFor="token-name"
          >
            New token name
          </label>
          <FormInput
            ref={apiTokens.nameInputReference}
            id="token-name"
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
        <div className="space-y-4 -mx-6 my-6 p-6 pb-2 border-y border-[var(--border)] border-dotted">
          {/*
           * `role="status"` is scoped to the heading only so the raw token
           * value below is not blurted out as soon as the panel mounts.
           * The token itself is reachable via browse-mode navigation; the
           * aria-label on the <code> further protects it from being read
           * aloud incidentally (shoulder-surfing in shared spaces).
           */}
          <p className="mb-3 text-[var(--text-muted)] text-xs" role="status">
            <span className="text-[var(--text)] font-semibold">
              Your new token has been created.
            </span>{' '}
            It'll only be shown once, so make sure you copy it down before
            navigating away from this page!
          </p>
          <div className="flex flex-col items-start gap-4">
            <code
              aria-label="Personal access token — navigate here to read it character by character"
              className="w-full block px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-mono rounded select-all"
            >
              {apiTokens.newToken.rawToken}
            </code>
            <IconButton
              className="group"
              data-copied={apiTokens.copied ? 'true' : undefined}
              aria-label="Copy to clipboard"
              onClick={() => void apiTokens.handleCopy()}
            >
              {/*
               * Both icons share a single grid cell so they stack without
               * layout shift and each can scale/blur independently. An
               * `absolute inset-0` overlay would resolve to a zero-area box
               * here (the wrapper would be inline with no intrinsic size).
               * `aria-hidden` on the wrapper keeps AT off the visual stack
               * — the button's `aria-label` is the single source of truth
               * for the name.
               */}
              <span
                aria-hidden="true"
                className="inline-grid place-items-center"
              >
                <span className="col-start-1 row-start-1 opacity-0 blur-xs scale-[0.25] group-data-[copied]:opacity-100 group-data-[copied]:blur-none group-data-[copied]:scale-100 transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
                  <i className="fa-solid fa-check text-[0.7rem]" />
                </span>
                <span className="col-start-1 row-start-1 opacity-100 blur-none scale-100 group-data-[copied]:opacity-0 group-data-[copied]:blur-xs group-data-[copied]:scale-[0.25] transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
                  <i className="fa-solid fa-copy text-[0.7rem]" />
                </span>
              </span>
              Copy to clipboard
            </IconButton>
          </div>
          {/*
           * Dedicated polite live region for the copy state change. Adding
           * it as a sibling lets AT announce "Token copied to clipboard"
           * even though the copy button keeps focus (a focused button's
           * own accessible-name change is not reliably re-announced).
           */}
          <span className="sr-only" role="status">
            {apiTokens.copied ? 'Token copied to clipboard' : ''}
          </span>
        </div>
      )}

      <ApiTokensList
        onRevoke={apiTokens.handleRevoke}
        tokens={apiTokens.tokens}
      />

      <LinkButton onClick={() => navigate('/settings/api')}>
        View the API documentation
      </LinkButton>
    </div>
  );
}
