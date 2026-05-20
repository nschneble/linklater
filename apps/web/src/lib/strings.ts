/**
 * Capitalizes the first character of a string. Used to normalize error
 * messages that may arrive in lowercase from the server.
 */
export function capitalizeFirst(message: string): string {
  if (!message) return message;
  return message.charAt(0).toUpperCase() + message.slice(1);
}

/**
 * Extracts plain text from an HTML string. Some sites embed HTML tags in
 * their meta description, so this strips them before display.
 */
export function stripHtml(html: string): string {
  return (
    new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
  );
}
