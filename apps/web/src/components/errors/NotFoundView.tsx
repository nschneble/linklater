import { FULL_SCREEN_CENTER } from '../../lib/styles';
import PrimaryButton from '../common/PrimaryButton';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

export default function NotFoundView() {
  const navigate = useNavigate();
  const location = useLocation();
  const mainReference = useRef<HTMLElement>(null);

  useEffect(() => {
    if (location.pathname !== '/not-found') {
      navigate('/not-found', { replace: true });
    }
  }, [location.pathname, navigate]);

  // no skip link here; focus on mount so keyboard users land (SC 2.4.3)
  useEffect(() => {
    mainReference.current?.focus();
  }, []);

  return (
    <main
      ref={mainReference}
      tabIndex={-1}
      className={`${FULL_SCREEN_CENTER} bg-[var(--base-bg)] text-[var(--base-text)] focus:outline-none select-none`}
    >
      <div className="flex flex-col items-center m-auto px-4 text-center">
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
    </main>
  );
}
