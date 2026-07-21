/**
 * Returns `true` when `text` looks like a URL. Used as a quick pre-check
 * before saving, both by the window paste listener (`usePasteDetection`) and
 * by the "Paste & save" button. We don't fully validate the URL here because
 * `createLink` on the server will reject it if it turns out to be invalid.
 */
export function looksLikeUrl(text: string): boolean {
  return text.startsWith('http://') || text.startsWith('https://');
}
