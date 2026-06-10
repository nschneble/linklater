import FeaturesSection from './FeaturesSection';
import FooterSection from './FooterSection';
import HeroSection from './HeroSection';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';

/**
 * Public-facing marketing page rendered at the root `/` route.
 *
 * Composed of three full-width sections stacked vertically:
 * 1. `HeroSection` — headline, tagline, and call-to-action buttons
 * 2. `FeaturesSection` — grid of feature tiles (Save, Stumble!, Share)
 * 3. `FooterSection` — links to About, GitHub, and Contact
 *
 * Uses the `hit-man` Tailwind background token so it renders with the
 * landing-page theme rather than the authenticated app's CSS variables.
 */
export default function LandingPage() {
  useDocumentTitle('Linklater');

  return (
    <div className="min-h-screen bg-hit-man">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[var(--mount-bg)] focus:text-[var(--mount-text)] focus:text-sm focus:font-semibold focus:rounded-lg focus:ring-2 focus:ring-[var(--focus-ring)] focus:outline-none"
      >
        Skip to main content
      </a>
      <main id="main-content">
        <HeroSection />
        <FeaturesSection />
      </main>
      <FooterSection />
    </div>
  );
}
