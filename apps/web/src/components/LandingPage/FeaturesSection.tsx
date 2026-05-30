interface FeatureTileProps {
  description: string;
  // e.g. 'fa-solid fa-bookmark'
  icon: string;
  title: string;
}

function FeatureTile({ description, icon, title }: FeatureTileProps) {
  return (
    <div className="flex flex-col gap-3 p-6 bg-midnight border border-boyhood rounded-2xl animate-fade-in-up">
      <i className={`${icon} text-2xl text-sunrise`} aria-hidden="true" />
      <h3 className="text-dazed text-sm font-semibold">{title}</h3>
      <p className="text-confused text-xs text-balance leading-relaxed">
        {description}
      </p>
    </div>
  );
}

const FEATURES: FeatureTileProps[] = [
  {
    description:
      'Save links from literally anywhere. A New York Times recipe on your laptop. A Reddit thread on your phone. A Facebook post your mom emailed you, again.',
    icon: 'fa-solid fa-bookmark',
    title: 'Save',
  },
  {
    description:
      'Decision fatigue is real. We can serve up a random unread link from your collection, and all you gotta do is read it. Bringing back the best of the 2000s!',
    icon: 'fa-brands fa-stumbleupon',
    title: 'Stumble!',
  },
  {
    description:
      'Half the fun of learning something new is sharing it with those around you. Be the annoying person at the metaphorical water cooler with a fun fact.',
    icon: 'fa-solid fa-share',
    title: 'Share',
  },
];

export default function FeaturesSection() {
  return (
    <section
      aria-labelledby="features-heading"
      className="max-w-3xl mx-auto px-6 pb-24 select-none"
    >
      <h2 id="features-heading" className="sr-only">
        Features
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {FEATURES.map((feature) => (
          <FeatureTile key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
}
