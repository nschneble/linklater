import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ResetPasswordPage from './ResetPasswordPage';

export function renderPage(search = '?token=valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

export function fillForm() {
  fireEvent.change(screen.getByLabelText(/^new password/i), {
    target: { value: 'correct-horse-battery' },
  });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), {
    target: { value: 'correct-horse-battery' },
  });
}
