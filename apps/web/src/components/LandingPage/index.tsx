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
 * 3. `FooterSection` – links to Terms, Privacy, Contact, and the
 *    author's site
 *
 * Carries `data-theme='branding'` so the off-book `branding` cascade
 * drives every bundle token, and keeps the `hit-man` Tailwind background
 * gradient on top rather than inheriting the authenticated app's theme.
 */
export default function LandingPage() {
  useDocumentTitle('Linklater – Save links now, read them later.');

  return (
    <div data-theme="branding" className="min-h-screen bg-hit-man">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[var(--base-highlight)] focus:text-[var(--base-highlight-fg)] focus:text-sm focus:font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-[var(--focus-ring)] focus:rounded-lg"
      >
        Skip to main content
      </a>
      <a
        href="https://github.com/nschneble/linklater"
        className="github-fork-ribbon select-none"
        data-ribbon="Fork me on GitHub"
        title="Fork me on GitHub"
      >
        Fork me on GitHub
      </a>
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <HeroSection />
        <FeaturesSection />
      </main>
      <FooterSection />
    </div>
  );
}
