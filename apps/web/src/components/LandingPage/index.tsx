import { useNavigate } from 'react-router-dom';
import PrimaryButton from '../common/PrimaryButton';

/**
 * The landing page for Linklater.
 *
 * Contains resources for all aspects of the app, including marketing,
 * support, latest news, and user login.
 */
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-[var(--bg)] text-[var(--text)] text-center select-none">
      <i
        className="fa-solid fa-link text-4xl text-[var(--text-subtle)] mb-4"
        aria-hidden="true"
      />
      <h1 className="mb-2 text-lg font-semibold">Linklater</h1>
      <p className="mb-6 text-[var(--text-muted)] text-sm">
        Save links now, read them later.
      </p>

      <PrimaryButton type="button" onClick={() => navigate('/login')}>
        <i
          className="fa-solid fa-arrow-right-to-bracket text-xs"
          aria-hidden="true"
        />
        Log in
      </PrimaryButton>
    </div>
  );
}
