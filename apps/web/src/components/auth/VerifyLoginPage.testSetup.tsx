import { MemoryRouter } from 'react-router';
import { render } from '@testing-library/react';
import VerifyLoginPage from './VerifyLoginPage';

export function renderPage(search = '?token=valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/verify-login${search}`]}>
      <VerifyLoginPage />
    </MemoryRouter>,
  );
}
