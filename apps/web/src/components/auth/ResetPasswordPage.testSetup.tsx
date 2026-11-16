import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect } from 'vitest';
import { MemoryRouter } from 'react-router';
import ResetPasswordPage from './ResetPasswordPage';

const PASSWORD = 'correct-horse-battery';

export const TOKEN_ERROR = new Error('Invalid or expired reset token.');

export function renderPage(search = '?token=valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

export function confirmField() {
  return screen.getByLabelText(/confirm new password/i);
}

export function newPasswordField() {
  return screen.getByLabelText(/^new password/i);
}

export function fillForm(confirm = PASSWORD) {
  fireEvent.change(newPasswordField(), { target: { value: PASSWORD } });
  fireEvent.change(confirmField(), { target: { value: confirm } });
}

export async function submitFromButton() {
  const submitButton = screen.getByRole('button', { name: /reset password/i });
  submitButton.focus();
  expect(submitButton).toHaveFocus();

  await act(async () => {
    fireEvent.submit(submitButton.closest('form')!);
  });
}
