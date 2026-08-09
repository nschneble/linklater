/**
 * The one comparison shared by every ordering decision the local import
 * rules make, at the statement level and inside the braces alike.
 *
 * It sits in its own file so neither caller owns it: if the two ever sorted
 * by different rules, a fix at one level could keep reintroducing a
 * violation at the other and the autofix would never settle.
 */

export function compareIdentifiers(first, second) {
  return first.localeCompare(second, 'en', { sensitivity: 'base' });
}
