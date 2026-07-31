/**
 * Formats a past instant as a fuzzy natural-language phrase ("a few hours
 * ago", "a week ago"). Returns phrasing without a leading capital so callers
 * can compose it into a sentence ("Created a few hours ago", "was last used
 * a minute ago").
 *
 * Future dates are clamped to "a few seconds ago" rather than throwing; a
 * tiny clock skew between client and server should never crash the UI.
 */
export function formatRelativeTimeFuzzy(date: Date | string): string {
  const instant = typeof date === 'string' ? new Date(date) : date;
  const deltaMs = Math.max(0, Date.now() - instant.getTime());
  const seconds = Math.floor(deltaMs / 1000);

  if (seconds < 60) {
    return 'a few seconds ago';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 2) {
    return 'a minute ago';
  }
  if (minutes < 60) {
    return 'a few minutes ago';
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 2) {
    return 'an hour ago';
  }
  if (hours < 24) {
    return 'a few hours ago';
  }

  const days = Math.floor(hours / 24);
  if (days < 2) {
    return 'a day ago';
  }
  if (days < 7) {
    return 'a few days ago';
  }
  if (days < 14) {
    return 'a week ago';
  }
  if (days < 28) {
    return 'a few weeks ago';
  }
  if (days < 60) {
    return 'a month ago';
  }
  if (days < 365) {
    return 'a few months ago';
  }

  return 'over a year ago';
}
