import { FOCUS_RING } from '../../lib/styles';
import type { Ref } from 'react';
import { Link } from 'react-router-dom';

interface ReadingListLinkProps {
  children: string;
  ref?: Ref<HTMLAnchorElement>;
}

/**
 * The recovery navigation shared by every readable SavePage state: a
 * client-side link to the reading list. It carries `focusMain` so the reading
 * list moves focus to its <main> on arrival, keeping route-change focus intact
 * for keyboard and screen-reader users (WCAG 2.4.3). The text names the
 * destination so it stands on its own out of context (WCAG 2.4.4 / 2.4.9).
 */
export default function ReadingListLink({
  children,
  ref,
}: ReadingListLinkProps) {
  return (
    <Link
      ref={ref}
      to="/unread"
      state={{ focusMain: true }}
      className={`text-[var(--base-alt-text)] hover:text-[var(--base-text)] text-sm underline underline-offset-3 ${FOCUS_RING} rounded transition duration-200`}
    >
      {children}
    </Link>
  );
}
