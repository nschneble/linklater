interface FeatureTileProps {
  description: string;
  icon: string;
  title: string;
}

function FeatureTile({ description, icon, title }: FeatureTileProps) {
  return (
    <div className="flex flex-col gap-3 p-6 bg-[#1a1530] border border-[#2e2855] rounded-2xl animate-fade-in-up">
      <i className={`${icon} text-2xl text-[#c03812]`} aria-hidden="true" />
      <h3 className="text-[#eeeede] text-sm font-semibold">{title}</h3>
      <p className="text-[#9b92c8] text-xs leading-relaxed">{description}</p>
    </div>
  );
}

const FEATURES: FeatureTileProps[] = [
  {
    description:
      'Paste a URL, use the bookmarklet, or type it in — your choice.',
    icon: 'fa-solid fa-bolt',
    title: 'Save in a flash',
  },
  {
    description: 'Why make choices when you can just roll the wheels of fate?',
    icon: 'fa-solid fa-shuffle',
    title: 'Stumble',
  },
  {
    description:
      'Full keyboard navigation. Add, search, stumble without a mouse.',
    icon: 'fa-solid fa-keyboard',
    title: 'Keyboard-first',
  },
];

export default function FeaturesSection() {
  return (
    <section className="px-6 pb-24 max-w-3xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {FEATURES.map((feature) => (
          <FeatureTile key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
}
