import FeaturesSection from './FeaturesSection';
import FooterSection from './FooterSection';
import HeroSection from './HeroSection';

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
  return (
    <div className="min-h-screen bg-hit-man">
      <HeroSection />
      <FeaturesSection />
      <FooterSection />
    </div>
  );
}
