import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import IconButton from '../common/IconButton';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import TabButton from '../common/TabButton';
import AuthCard from './AuthCard';
import type { FormEvent, RefObject } from 'react';

const googleSsoEnabled = import.meta.env.VITE_GOOGLE_SSO_ENABLED === 'true';
const appleSsoEnabled = import.meta.env.VITE_APPLE_SSO_ENABLED === 'true';

type LoginRegisterMode = 'login' | 'register';

function submitLabel(
  loading: boolean,
  isMagicLink: boolean,
  mode: LoginRegisterMode,
): string {
  if (loading) return 'Working…';
  if (isMagicLink) {
    return mode === 'login'
      ? 'Log in with magic link'
      : `Sign up with magic link`;
  }
  return mode === 'login' ? 'Log in' : 'Create account';
}

interface LoginRegisterViewProps {
  email: string;
  emailReference: RefObject<HTMLInputElement | null>;
  error: string | null;
  loading: boolean;
  magicLinkSent: boolean;
  mode: LoginRegisterMode;
  onEmailChange: (email: string) => void;
  onForgotPassword: () => void;
  onMagicLinkBack: () => void;
  onModeChange: (mode: LoginRegisterMode) => void;
  onPasswordChange: (password: string) => void;
  onSubmit: (event: FormEvent) => void;
  password: string;
  passwordReference: RefObject<HTMLInputElement | null>;
}

export default function LoginRegisterView({
  email,
  emailReference,
  error,
  loading,
  magicLinkSent,
  mode,
  onEmailChange,
  onForgotPassword,
  onMagicLinkBack,
  onModeChange,
  onPasswordChange,
  onSubmit,
  password,
  passwordReference,
}: LoginRegisterViewProps) {
  return (
    <AuthCard>
      <h1 className="mb-2 text-[var(--text)] text-center text-3xl font-bold text-balance">
        Linklater
      </h1>
      <p className="mb-6 text-[var(--text-muted)] text-center">
        Save links now, read them later.
      </p>

      {magicLinkSent ? (
        <div className="text-center space-y-4">
          <Alert icon="fa-envelope" variant="success">
            {mode === 'login'
              ? 'Check your email for a login link'
              : 'Check your email to complete signup'}
          </Alert>
          <LinkButton onClick={onMagicLinkBack}>Back to login</LinkButton>
        </div>
      ) : (
        <>
          <div
            className="relative flex mb-[24.5px] p-1 bg-[var(--bg-elevated)] rounded-full"
            role="tablist"
            aria-label="Authentication mode"
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') onModeChange('register');
              else if (event.key === 'ArrowLeft') onModeChange('login');
            }}
          >
            <div
              aria-hidden="true"
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-[var(--text)] rounded-full"
              style={{
                transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform:
                  mode === 'register' ? 'translateX(100%)' : 'translateX(0)',
              }}
            />
            <TabButton
              aria-controls="auth-form-panel"
              className="flex-1 py-2 text-sm"
              isActive={mode === 'login'}
              onClick={() => onModeChange('login')}
            >
              Log in
            </TabButton>
            <TabButton
              aria-controls="auth-form-panel"
              className="flex-1 py-2 text-sm"
              isActive={mode === 'register'}
              onClick={() => onModeChange('register')}
            >
              Sign up
            </TabButton>
          </div>

          <form id="auth-form-panel" className="space-y-4" onSubmit={onSubmit}>
            <label
              className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
              htmlFor="auth-email"
            >
              Email
            </label>
            <FormInput
              id="auth-email"
              ref={emailReference}
              type="email"
              autoComplete="email"
              onChange={(event) => onEmailChange(event.target.value)}
              value={email}
              required
            />

            <label
              className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
              htmlFor="auth-password"
            >
              Password
            </label>
            <FormInput
              id="auth-password"
              ref={passwordReference}
              type="password"
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Leave blank to use magic link"
              value={password}
              required={false}
            />

            {error && (
              <Alert icon="fa-triangle-exclamation" variant="error">
                {error}
              </Alert>
            )}

            <PrimaryButton disabled={loading} className="w-full py-2.5">
              <i
                className={`fa-solid ${password.length === 0 ? 'fa-wand-magic-sparkles' : 'fa-right-to-bracket'} text-xs`}
                aria-hidden="true"
              />
              {submitLabel(loading, password.length === 0, mode)}
            </PrimaryButton>
          </form>

          {(googleSsoEnabled || appleSsoEnabled) && (
            <>
              <div className="relative my-5">
                <div
                  className="absolute inset-0 flex items-center"
                  aria-hidden="true"
                >
                  <div className="w-full border-t border-[var(--border)]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs">
                    or continue with
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {googleSsoEnabled && (
                  <IconButton
                    variant="elevated"
                    title="Continue with Google"
                    className="w-full py-2.5 rounded-lg"
                    onClick={() => {
                      window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google`;
                    }}
                  >
                    <i
                      className="fa-brands fa-google text-[0.7rem]"
                      aria-hidden="true"
                    />
                    Continue with Google
                  </IconButton>
                )}

                {appleSsoEnabled && (
                  <a
                    href={`${import.meta.env.VITE_API_BASE_URL}/auth/apple`}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-sm font-medium rounded-lg transition hover:opacity-80"
                    aria-label="Continue with Apple"
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
                  </a>
                )}
              </div>
            </>
          )}

          <div
            aria-hidden={mode !== 'login' ? true : undefined}
            className={`mt-4 flex flex-col items-center gap-2 text-center transition-opacity duration-200 ${mode === 'login' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <LinkButton
              tabIndex={mode !== 'login' ? -1 : undefined}
              onClick={onForgotPassword}
            >
              I literally have no idea what my password is
            </LinkButton>
          </div>
        </>
      )}
    </AuthCard>
  );
}
