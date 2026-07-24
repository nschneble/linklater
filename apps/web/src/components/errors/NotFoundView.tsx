import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import PrimaryButton from '../common/PrimaryButton';

export default function NotFoundView() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/not-found') {
      navigate('/not-found', { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-[var(--base-bg)] text-[var(--base-text)] text-center select-none">
      <i
        className="fa-solid fa-person-digging text-4xl text-[var(--base-subtle-text)] mb-4"
        aria-hidden="true"
      />
      <h1 className="mb-2 text-lg font-semibold">Page not found</h1>
      <p className="mb-6 text-[var(--base-alt-text)] text-sm">
        That page doesn't exist. <span className="italic">Maybe a typo?</span>
      </p>

      <PrimaryButton
        type="button"
        surface="base"
        onClick={() => navigate('/unread')}
      >
        <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
        Back to Linklater
      </PrimaryButton>
    </div>
  );
}
