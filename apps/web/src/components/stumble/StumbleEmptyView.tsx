import IconButton from '../common/IconButton';
import PixelArtGhost from './PixelArtGhost';
import SuggestionCallout from '../links/SuggestionCallout';
import { useNavigate } from 'react-router';

/**
 * Full-page empty state shown by `StumblePage` when the user has no
 * unread links. Displays a pixel-art ghost, a playful headline, and a
 * single-suggestion CTA card (shared with the main unread empty state)
 * so a one-click "Add and read" jumps the user into an article from one
 * randomly picked source.
 *
 * The fallback prop on `SuggestionCallout` preserves the "Suggestions
 * are napping too." copy when the suggestions endpoint produces nothing
 * – without it the page would silently lose all suggestion messaging.
 */
export default function StumbleEmptyView() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-svh px-4 py-12 bg-[var(--base-bg)] text-[var(--base-text)] text-center select-none">
      <div className="mb-8">
        <PixelArtGhost />
      </div>

      <h1 className="mb-6 text-xl font-semibold text-balance">
        Boo. Your reading list is empty.
      </h1>

      <SuggestionCallout
        fallback={
          <p className="mb-8 text-[var(--base-subtle-text)] text-xs italic">
            (Suggestions are napping too.)
          </p>
        }
      />

      <IconButton
        variant="elevated"
        surface="base"
        className="mt-8"
        onClick={() => navigate('/unread')}
      >
        <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
        Back to Linklater
      </IconButton>
    </div>
  );
}
