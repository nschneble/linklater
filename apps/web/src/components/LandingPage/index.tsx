import FeaturesSection from './FeaturesSection';
import FooterSection from './FooterSection';
import HeroSection from './HeroSection';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-hit-man">
      <HeroSection />
      <FeaturesSection />
      <FooterSection />
    </div>
  );
}
