import type { Link } from '../lib/api';
import LinkCardLayout from './LinkCardLayout';

export function LinkCardSkeleton() {
  return (
    <div className="relative border-l-4 border-[var(--border)] rounded-r-xl bg-[var(--bg-surface)] pl-10 pr-8 py-4 animate-pulse">
      <div className="absolute left-0 top-4 -translate-x-1/2 w-8 h-8 rounded-full bg-[var(--bg-elevated)]" />
      <div className="space-y-1">
        <div className="w-24 h-3 bg-[var(--bg-elevated)] rounded" />
        <div className="w-3/4 h-4 bg-[var(--bg-elevated)] rounded" />
        <div className="h-12 space-y-1">
          <div className="w-full h-3 bg-[var(--bg-elevated)] rounded" />
          <div className="w-2/3 h-3 bg-[var(--bg-elevated)] rounded" />
        </div>
        <div className="w-full h-40 bg-[var(--bg-elevated)] rounded-md mt-0 mb-4" />
      </div>
    </div>
  );
}

interface LinkCardProps {
  link: Link;
  animationDelay?: number;
  onArchiveToggle: () => void;
}

export default function LinkCard({
  link,
  animationDelay = 0,
  onArchiveToggle,
}: LinkCardProps) {
  function handleCardClick() {
    window.open(link.url, '_blank', 'noreferrer');
    if (!link.archivedAt) {
      onArchiveToggle();
    }
  }

  function handleUnarchiveClick(event: React.MouseEvent) {
    event.stopPropagation();
    onArchiveToggle();
  }

  return (
    <LinkCardLayout
      link={link}
      animationDelay={animationDelay}
      onCardClick={handleCardClick}
      onUnarchiveClick={handleUnarchiveClick}
    />
  );
}
