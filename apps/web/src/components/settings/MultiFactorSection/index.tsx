import Alert from '../../common/Alert';
import LinkButton from '../../common/LinkButton';
import PrimaryButton from '../../common/PrimaryButton';
import StatusBadge from '../../common/StatusBadge';
import ReauthForm from '../ReauthForm';
import RecoveryCodesModal from '../RecoveryCodesModal';
import TotpSetupView from '../TotpSetupView';
import { useMultiFactor } from './useMultiFactor';

/**
 * Settings section for multi-factor authentication.
 *
 * All state and API calls live in `useMultiFactor`. This component renders the
 * five mutually-exclusive UI states that hook drives:
 *
 * - **State A** — MFA disabled. Shows the "Add authenticator app" button.
 * - **State B** — TOTP setup in progress. Shows `TotpSetupView` with QR +
 *   verification form. Either an in-session start or a server-side
 *   `multiFactorPending` flag from a prior session can land us here.
 * - **State C / E** — MFA enabled. Shows Regenerate / Disable actions.
 * - **State D** — Pending recovery: server reports `multiFactorPending` but no
 *   local `totpSetup`. Shows "Continue setup" / Cancel pair.
 * - **Reauth** — Disable or Regenerate requested, awaiting credentials.
 */
export default function MultiFactorSection() {
  const {
    addAuthenticatorReference,
    error,
    inStateA,
    loading,
    reauthAction,
    reauthCode,
    reauthPassword,
    recoveryCodes,
    totpCode,
    totpCodeInputReference,
    totpSetup,
    multiFactorMethod,
    multiFactorPending,
    user,
    handleCancelReauth,
    handleCancelTotpSetup,
    handleReauth,
    handleRecoveryCodesConfirmed,
    handleStartTotpSetup,
    handleVerifyTotp,
    setError,
    setReauthAction,
    setReauthCode,
    setReauthPassword,
    setTotpCode,
  } = useMultiFactor();

  return (
    <div className="max-w-md space-y-4">
      {recoveryCodes && (
        <RecoveryCodesModal
          codes={recoveryCodes}
          onConfirm={handleRecoveryCodesConfirmed}
        />
      )}

      {/* Re-authentication form for disable / regenerate */}
      {reauthAction && (
        <ReauthForm
          action={reauthAction}
          code={reauthCode}
          error={error}
          hasPassword={user?.hasPassword ?? false}
          loading={loading}
          onCancel={handleCancelReauth}
          onCodeChange={setReauthCode}
          onPasswordChange={setReauthPassword}
          onSubmit={handleReauth}
          password={reauthPassword}
          multiFactorMethod={multiFactorMethod}
        />
      )}

      {/* State C / E — MFA enabled */}
      {!reauthAction && multiFactorMethod && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-sm">
              Authenticator app
            </span>
            <StatusBadge variant="success" icon="fa-solid fa-circle-check">
              Enabled
            </StatusBadge>
          </div>
          <div className="flex flex-col gap-2">
            <LinkButton
              onClick={() => {
                setError(null);
                setReauthAction('regenerate');
              }}
            >
              Regenerate recovery codes
            </LinkButton>
            <LinkButton
              onClick={() => {
                setError(null);
                setReauthAction('disable');
              }}
            >
              Disable multi-factor authentication
            </LinkButton>
          </div>
        </div>
      )}

      {/* State B — TOTP setup: verify QR */}
      {!reauthAction && !multiFactorMethod && totpSetup && (
        <TotpSetupView
          code={totpCode}
          codeInputReference={totpCodeInputReference}
          error={error}
          loading={loading}
          onCancel={handleCancelTotpSetup}
          onCodeChange={setTotpCode}
          onSubmit={handleVerifyTotp}
          qrCodeDataUrl={totpSetup.qrCodeDataUrl}
          secret={totpSetup.secret}
        />
      )}

      {/* State B — TOTP pending from server (setup started in prior session) */}
      {!reauthAction &&
        !multiFactorMethod &&
        !totpSetup &&
        multiFactorPending && (
          <div className="space-y-3">
            <p className="text-[var(--text-muted)] text-sm">
              Authenticator app setup is in progress.
            </p>
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex items-center gap-3">
              <PrimaryButton
                disabled={loading}
                className="py-2.5"
                onClick={handleStartTotpSetup}
              >
                {loading ? 'Continuing…' : 'Continue setup'}
              </PrimaryButton>
              <LinkButton onClick={handleCancelTotpSetup} disabled={loading}>
                Cancel
              </LinkButton>
            </div>
          </div>
        )}

      {/* State A — MFA not enabled */}
      {inStateA && (
        <div className="space-y-3">
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex items-center gap-2">
            <PrimaryButton
              ref={addAuthenticatorReference}
              disabled={loading}
              className="py-2.5"
              onClick={handleStartTotpSetup}
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
