import FeaturesSection from './FeaturesSection';
import FooterSection from './FooterSection';
import HeroSection from './HeroSection';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';

/**
 * Public-facing marketing page rendered at the root `/` route.
 *
 * Composed of three full-width sections stacked vertically:
 * 1. `HeroSection` – headline, tagline, and call-to-action buttons
 * 2. `FeaturesSection` – grid of feature tiles (Save, Stumble!, Share)
 * 3. `FooterSection` – links to About, GitHub, and Contact
 *
 * Uses the `hit-man` Tailwind background token so it renders with the
 * landing-page theme rather than the authenticated app's CSS variables.
 */
export default function LandingPage() {
  useDocumentTitle('Linklater – Save links now, read them later.');

  return (
    <div className="min-h-screen bg-hit-man">
      {/* Skip link is brand-locked to white-on-navy: bg-hit-man is a fixed
          radial gradient (~#14103a → #0a0812) that doesn't honor user themes,
          so the user-theme --focus-ring may not clear 3:1 against it for
          warm light themes (a11y-lead M-1, gang pass). White ring
          on white body clears 16:1+ vs the navy gradient. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-white focus:text-[#14103a] focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white focus:rounded-lg"
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
