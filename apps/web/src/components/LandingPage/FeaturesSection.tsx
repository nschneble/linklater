/** Props for an individual `FeatureTile` card. */
interface FeatureTileProps {
  /** One or two sentences describing the feature. */
  description: string;
  /** Font Awesome icon class string (e.g. `'fa-solid fa-bookmark'`). */
  icon: string;
  /** Short feature name displayed as the card heading. */
  title: string;
}

/**
 * A single feature card on the landing page. Renders a Font Awesome icon,
 * a heading, and a short description inside a rounded card.
 */
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

/**
 * Three-column feature grid for the public landing page. Renders the
 * `FEATURES` array as a responsive grid of `FeatureTile` cards.
 */
export default function FeaturesSection() {
  return (
    <section aria-label="Features" className="px-6 pb-24 max-w-3xl mx-auto select-none">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {FEATURES.map((feature) => (
          <FeatureTile key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
}
