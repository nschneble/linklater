import ConfirmAccountDeletionPage from './ConfirmAccountDeletionPage';
import { MemoryRouter } from 'react-router';
import { render } from '@testing-library/react';

export function renderPage(search = '?token=valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/account/confirm-deletion${search}`]}>
      <ConfirmAccountDeletionPage />
    </MemoryRouter>,
  );
}
