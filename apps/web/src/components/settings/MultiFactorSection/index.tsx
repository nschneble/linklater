import Alert from '../../common/Alert';
import IconButton from '../../common/IconButton';
import LinkButton from '../../common/LinkButton';
import PrimaryButton from '../../common/PrimaryButton';
import StatusBadge from '../../common/StatusBadge';
import ReauthForm from '../ReauthForm';
import RecoveryCodesPanel from '../RecoveryCodesPanel';
import TotpSetupView from '../TotpSetupView';
import { useAuth } from '../../../auth/AuthContext';
import { useMultiFactor } from './useMultiFactor';

/**
 * Settings section for multi-factor authentication.
 *
 * All state and API calls live in `useMultiFactor`. This component renders the
 * five mutually-exclusive UI states that hook drives:
 *
 * - **State A** – MFA disabled. Shows the "Add authenticator app" button.
 * - **State B** – TOTP setup in progress. Shows `TotpSetupView` with QR +
 *   verification form. Either an in-session start or a server-side
 *   `multiFactorPending` flag from a prior session can land us here.
 * - **State C / E** – MFA enabled. Shows Regenerate / Disable actions.
 * - **State D** – Pending recovery: server reports `multiFactorPending` but no
 *   local `totpSetup`. Shows "Continue setup" / Cancel pair.
 * - **Reauth** – Disable or Regenerate requested, awaiting credentials.
 */
export default function MultiFactorSection() {
  const { user } = useAuth();
  const mfa = useMultiFactor();

  return (
    <div className="max-w-md space-y-4">
      {/* Re-authentication form for disable / regenerate */}
      {mfa.reauthAction && (
        <ReauthForm
          prompt={
            mfa.reauthAction === 'disable'
              ? 'Confirm your identity to disable multi-factor authentication.'
              : 'Confirm your identity to generate new recovery codes.'
          }
          srOnlyHeading={
            mfa.reauthAction === 'disable'
              ? 'Confirm to disable multi-factor authentication'
              : 'Confirm to regenerate recovery codes'
          }
          submitLabel="Confirm"
          submittingLabel="Confirming…"
          code={mfa.reauthCode}
          error={mfa.error}
          hasPassword={user?.hasPassword ?? false}
          hasMfa={true}
          loading={mfa.loading}
          onCancel={mfa.handleCancelReauth}
          onCodeChange={mfa.setReauthCode}
          onPasswordChange={mfa.setReauthPassword}
          onSubmit={mfa.handleReauth}
          password={mfa.reauthPassword}
        />
      )}

      {/* Recovery codes reveal – shown after enrollment or regeneration. */}
      {mfa.recoveryCodes && <RecoveryCodesPanel codes={mfa.recoveryCodes} />}

      {/* State C / E – MFA enabled. While `recoveryCodes` is non-null the
       * panel below takes over the action area to keep the user focused on
       * saving the codes and to prevent an accidental disable click mid-
       * confirmation. */}
      {!mfa.reauthAction && mfa.multiFactorMethod && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[var(--mount-alt-text)] text-xs">
              Authenticator app
            </span>
            <StatusBadge variant="success" icon="fa-solid fa-circle-check">
              Enabled
            </StatusBadge>
          </div>
          {!mfa.recoveryCodes && (
            <div className="flex items-center gap-2">
              <IconButton
                onClick={() => {
                  mfa.setError(null);
                  mfa.setReauthAction('regenerate');
                }}
              >
                <i
                  className="fa-solid fa-rotate text-[0.7rem]"
                  aria-hidden="true"
                />
                Generate new recovery codes
              </IconButton>
              <IconButton
                variant="danger"
                onClick={() => {
                  mfa.setError(null);
                  mfa.setReauthAction('disable');
                }}
              >
                <i
                  className="fa-solid fa-ban text-[0.7rem]"
                  aria-hidden="true"
                />
                Disable MFA
              </IconButton>
            </div>
          )}
        </div>
      )}

      {/* State B – TOTP setup: verify QR */}
      {!mfa.reauthAction && !mfa.multiFactorMethod && mfa.totpSetup && (
        <TotpSetupView
          code={mfa.totpCode}
          codeInputReference={mfa.totpCodeInputReference}
          error={mfa.error}
          loading={mfa.loading}
          onCancel={mfa.handleCancelTotpSetup}
          onCodeChange={mfa.setTotpCode}
          onSubmit={mfa.handleVerifyTotp}
          qrCodeDataUrl={mfa.totpSetup.qrCodeDataUrl}
          secret={mfa.totpSetup.secret}
        />
      )}

      {/* State B – TOTP pending from server (setup started in prior session) */}
      {!mfa.reauthAction &&
        !mfa.multiFactorMethod &&
        !mfa.totpSetup &&
        mfa.multiFactorPending && (
          <div className="space-y-3">
            <p className="text-[var(--mount-alt-text)] text-xs">
              Authenticator app setup is in progress.
            </p>
            {mfa.error && <Alert variant="error">{mfa.error}</Alert>}
            <div className="flex items-center gap-3">
              <PrimaryButton
                disabled={mfa.loading}
                className="py-2.5"
                onClick={mfa.handleStartTotpSetup}
              >
                <i
                  className="fa-solid fa-circle-notch text-xs"
                  aria-hidden="true"
                />
                {mfa.loading ? 'Continuing…' : 'Continue setup'}
              </PrimaryButton>
              <LinkButton
                onClick={mfa.handleCancelTotpSetup}
                disabled={mfa.loading}
              >
                Cancel
              </LinkButton>
            </div>
          </div>
        )}

      {/* State A – MFA not enabled */}
      {mfa.inStateA && (
        <div className="space-y-3">
          <p className="text-[var(--mount-alt-text)] text-xs">
            MFA is currently off.
          </p>
          {mfa.error && <Alert variant="error">{mfa.error}</Alert>}
          <div className="flex items-center gap-2">
            <PrimaryButton
              ref={mfa.addAuthenticatorReference}
              disabled={mfa.loading}
              className="py-2.5"
              onClick={mfa.handleStartTotpSetup}
            >
              <i
                className="fa-solid fa-mobile-screen-button text-xs"
                aria-hidden="true"
              />
              Add authenticator app
            </PrimaryButton>
            <StatusBadge variant="info" icon="fa-solid fa-ranking-star">
              Recommended
            </StatusBadge>
          </div>
        </div>
      )}
    </div>
  );
}
