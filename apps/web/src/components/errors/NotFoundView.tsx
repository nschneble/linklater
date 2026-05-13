import { Link } from 'react-router-dom';
import { FOCUS_RING } from '../../lib/styles';

export default function NotFoundView() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center select-none">
      <p className="mb-1 text-[var(--text-muted)] text-xs font-medium uppercase tracking-widest">
        404
      </p>
      <h1 className="mb-3 text-xl font-semibold text-balance">
        Page not found
      </h1>
      <p className="mb-8 text-[var(--text-muted)] text-sm max-w-xs text-pretty">
        That path doesn&rsquo;t exist. Maybe a typo?
      </p>
      <Link
        to="/unread"
        className={`text-[var(--text-muted)] hover:text-[var(--text)] text-sm transition ${FOCUS_RING} rounded`}
      >
        ← Back to Linklater
      </Link>
    </div>
  );
}
