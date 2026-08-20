import Alert from '../common/Alert';
import AuthCard from './AuthCard';
import FormInput from '../common/FormInput';
import IconButton from '../common/IconButton';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import SlidingTabBar from '../common/SlidingTabBar';
import { useNavigate } from 'react-router';
import type { FormEvent, RefObject } from 'react';

type LoginRegisterMode = 'login' | 'register';

function submitLabel(isMagicLink: boolean, mode: LoginRegisterMode): string {
  if (isMagicLink) {
    return mode === 'login'
      ? 'Log in with magic link'
      : `Sign up with magic link`;
  }
  return mode === 'login' ? 'Log in' : 'Create account';
}

/**
 * Wraps a control's action so an in-flight submit swallows it. The controls
 * that need this stay focusable and take `aria-disabled` rather than the
 * native attribute, which drops focus to `<body>`, so nothing but this
 * guard is left to refuse the activation.
 */
function ignoreWhileLoading(loading: boolean, action: () => void): () => void {
  return () => {
    if (!loading) action();
  };
}

interface LoginRegisterViewProps {
  appleSsoEnabled?: boolean;
  email: string;
  emailReference: RefObject<HTMLInputElement | null>;
  error: string | null;
  errorReference: RefObject<HTMLParagraphElement | null>;
  googleSsoEnabled?: boolean;
  loading: boolean;
  magicLinkSentJustNow: boolean;
  mode: LoginRegisterMode;
  onEmailChange: (email: string) => void;
  onForgotPassword: () => void;
  onModeChange: (mode: LoginRegisterMode) => void;
  onPasswordChange: (password: string) => void;
  onSubmit: (event: FormEvent) => void;
  password: string;
  passwordReference: RefObject<HTMLInputElement | null>;
}

export default function LoginRegisterView({
  appleSsoEnabled = import.meta.env.VITE_APPLE_SSO_ENABLED === 'true',
  email,
  emailReference,
  error,
  errorReference,
  googleSsoEnabled = import.meta.env.VITE_GOOGLE_SSO_ENABLED === 'true',
  loading,
  magicLinkSentJustNow,
  mode,
  onEmailChange,
  onForgotPassword,
  onModeChange,
  onPasswordChange,
  onSubmit,
  password,
  passwordReference,
}: LoginRegisterViewProps) {
  const navigate = useNavigate();

  return (
    <AuthCard>
      <h1 className="mb-2 text-[var(--mount-text)] text-center text-3xl font-bold text-balance">
        Linklater
      </h1>
      <p className="mb-6 text-[var(--mount-alt-text)] text-center">
        Save links now, read them later.
      </p>

      {/* reserves an Alert row's height so an error shifts nothing */}
      <SlidingTabBar
        ariaLabel="Authentication mode"
        activeIndex={mode === 'register' ? 1 : 0}
        className="mb-[24.5px]"
        isDisabled={loading}
        surface="mount"
        tabClassName="py-2 text-sm"
        tabs={[
          {
            id: 'auth-tab-login',
            ariaControls: 'auth-form-panel',
            label: 'Log in',
            onClick: () => onModeChange('login'),
          },
          {
            id: 'auth-tab-register',
            ariaControls: 'auth-form-panel',
            label: 'Sign up',
            onClick: () => onModeChange('register'),
          },
        ]}
      />

      <form
        id="auth-form-panel"
        role="tabpanel"
        aria-labelledby={
          mode === 'login' ? 'auth-tab-login' : 'auth-tab-register'
        }
        className="space-y-4"
        onSubmit={onSubmit}
      >
        <label
          className="block text-[var(--mount-alt-text)] text-sm font-medium"
          htmlFor="auth-email"
        >
          Email
        </label>
        <FormInput
          id="auth-email"
          ref={emailReference}
          type="email"
          surface="mount"
          autoComplete="email"
          onChange={(event) => onEmailChange(event.target.value)}
          readOnly={loading}
          value={email}
          required
          aria-describedby="auth-form-error"
        />

        <label
          className="block text-[var(--mount-alt-text)] text-sm font-medium"
          htmlFor="auth-password"
        >
          Password
        </label>
        <FormInput
          id="auth-password"
          ref={passwordReference}
          type="password"
          surface="mount"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="Leave blank to use a magic link"
          readOnly={loading}
          value={password}
          required={false}
          aria-describedby="auth-form-error"
        />

        {/* always mounted: the inputs' aria-describedby cannot dangle */}
        {/* AuthForm focuses this, and a focused alert is announced twice */}
        <Alert
          announce={false}
          id="auth-form-error"
          ref={errorReference}
          icon="fa-triangle-exclamation"
          tabIndex={-1}
          variant="error"
        >
          {error}
        </Alert>

        <PrimaryButton
          className="group w-full py-2.5"
          aria-disabled={loading || magicLinkSentJustNow || undefined}
          data-busy={loading || undefined}
          data-cooldown={magicLinkSentJustNow || undefined}
        >
          <span aria-hidden="true" className="inline-grid place-items-center">
            <span className="col-start-1 row-start-1 opacity-0 blur-xs scale-[0.25] group-data-[busy]:opacity-100 group-data-[busy]:blur-none group-data-[busy]:scale-100 transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
              <i className="fa-solid fa-circle-notch text-[0.8125rem] group-data-[busy]:motion-safe:animate-spin" />
            </span>
            <span className="col-start-1 row-start-1 opacity-100 blur-none scale-100 group-data-[busy]:opacity-0 group-data-[busy]:blur-xs group-data-[busy]:scale-[0.25] transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
              <i
                className={`fa-solid ${magicLinkSentJustNow ? 'fa-wand-magic-sparkles' : password.length === 0 ? 'fa-wand-magic' : 'fa-right-to-bracket'} text-xs`}
              />
            </span>
          </span>
          {submitLabel(password.length === 0, mode)}
        </PrimaryButton>
      </form>

      {(googleSsoEnabled || appleSsoEnabled) && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div
              className="w-full border-t border-[var(--mount-border)]"
              aria-hidden="true"
            />
            <span className="shrink-0 text-[var(--mount-alt-text)] text-xs">
              or continue with
            </span>
            <div
              className="w-full border-t border-[var(--mount-border)]"
              aria-hidden="true"
            />
          </div>

          <div className="flex flex-col gap-2">
            {googleSsoEnabled && (
              <IconButton
                variant="elevated"
                className="w-full py-2.5 rounded-lg"
                onClick={ignoreWhileLoading(loading, () => {
                  window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google`;
                })}
                aria-disabled={loading || undefined}
              >
                <i
                  className="fa-brands fa-google text-[0.7rem]"
                  aria-hidden="true"
                />
                Continue with Google
              </IconButton>
            )}

            {appleSsoEnabled && (
              <IconButton
                variant="elevated"
                className="w-full py-2.5 rounded-lg"
                onClick={ignoreWhileLoading(loading, () => {
                  window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/apple`;
                })}
                aria-disabled={loading || undefined}
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 814 1000"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                >
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 405.1 45 281.9 77.2 207.3c21.6-49.9 68.3-82.9 120.4-82.9 46.1 0 91.1 25 100.2 51.3 8.8 25.2 9.8 57.7 9.8 75.5 0 47.8-4.3 91.1-12.2 127.4 54.7-16.5 88.4-80.9 88.4-150.5 0-73.3-21.3-130.6-63.7-162.8C288.8 40.5 241.2 15 185.1 15 89.8 15 45 72.9 45 107.1 0 107.1 0 113 0 118.8c0 73.2 46.5 204.4 99.4 253.2 5.8 5.5 13.2 10.5 21.6 14.9C79.5 436.9 46 534.5 46 563.8 46 658 94 788.1 167.6 852c61.6 53 125.5 85.9 196.2 85.9 91.9 0 124.2-47 209.4-47 85.5 0 126.7 47 212.8 47 105 0 185.9-93.5 244.3-220.6 32.4-70.3 46.5-100.3 46.5-100.3z" />
                </svg>
                Continue with Apple
              </IconButton>
            )}
          </div>
        </>
      )}

      <div className="flex flex-col items-center mt-4 text-center transition-opacity duration-200">
        {mode === 'login' && (
          <LinkButton
            onClick={ignoreWhileLoading(loading, onForgotPassword)}
            aria-disabled={loading || undefined}
          >
            I literally have no idea what my password is
          </LinkButton>
        )}
        {mode === 'register' && (
          <LinkButton onClick={() => navigate('/privacy')}>
            Read our privacy policy
          </LinkButton>
        )}
      </div>
    </AuthCard>
  );
}
