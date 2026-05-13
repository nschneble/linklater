import { useNavigate } from 'react-router-dom';
import PrimaryButton from '../common/PrimaryButton';

export default function NotFoundView() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-[var(--bg)] text-[var(--text)] text-center select-none">
      <i
        className="fa-solid fa-person-digging text-4xl text-[var(--text-subtle)] mb-4"
        aria-hidden="true"
      />
      <h1 className="mb-2 text-lg font-semibold">Page not found</h1>
      <p className="mb-6 text-[var(--text-muted)] text-sm">
        That page doesn't exist. <span className="italic">Maybe a typo?</span>
      </p>

      <PrimaryButton type="button" onClick={() => navigate('/unread')}>
        <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
        Back to Linklater
      </PrimaryButton>
    </div>
  );
}
