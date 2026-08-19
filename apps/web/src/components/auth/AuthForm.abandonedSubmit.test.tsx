/**
 * The real `useAuthForm` driving the real views, through the exit the
 * re-entrancy guard had no answer for: leaving a screen while its request
 * is still out.
 *
 * `useAuthForm.test.ts` drives the same move through `handleModeChange`.
 * This one goes through the button a user actually presses, because the
 * screen the guard stranded was reachable only that way — "Back to login"
 * carries no guard of its own, deliberately, since walking away from a
 * request is not something to refuse.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import AuthForm from './AuthForm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  forgotPassword: vi.fn(),
  registerMagicLink: vi.fn(),
  requestMagicLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

const loginMock = vi.fn();

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    login: loginMock,
    refreshUser: vi.fn(),
    register: vi.fn(),
  }),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import * as apiModule from '../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_EMAIL = 'test@example.com';
const USER_PASSWORD = 'strong-password-123';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthForm />
    </MemoryRouter>,
  );
}

function typeInto(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  loginMock.mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthForm – walking away from a request in flight', () => {
  it('hands back a working login form, not one whose submit is spent', async () => {
    vi.mocked(apiModule.forgotPassword).mockImplementation(
      () => new Promise<void>(() => {}),
    );

    renderAt('/forgot-password');
    await act(async () => {});

    typeInto(/email/i, USER_EMAIL);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /send password reset link/i }),
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /back to login/i }));
    });

    typeInto(/email/i, USER_EMAIL);
    typeInto(/password/i, USER_PASSWORD);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    });

    expect(loginMock).toHaveBeenCalledWith(USER_EMAIL, USER_PASSWORD);
  });

  it('leaves that form alone when the abandoned request finally answers', async () => {
    let settleForgot!: () => void;
    vi.mocked(apiModule.forgotPassword).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          settleForgot = () => resolve();
        }),
    );

    renderAt('/forgot-password');
    await act(async () => {});

    typeInto(/email/i, USER_EMAIL);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /send password reset link/i }),
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /back to login/i }));
    });
    typeInto(/password/i, USER_PASSWORD);

    await act(async () => {
      settleForgot();
    });

    expect(screen.queryByText('Reset link sent!')).toBeNull();
    expect(screen.getByRole('button', { name: 'Log in' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });
});
