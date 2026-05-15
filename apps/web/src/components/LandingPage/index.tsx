import FeaturesSection from './FeaturesSection';
import FooterSection from './FooterSection';
import HeroSection from './HeroSection';

export default function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, #14103a 0%, #0a0812 70%)',
      }}
    >
      <HeroSection />
      <FeaturesSection />
      <FooterSection />
    </div>
  );
}
