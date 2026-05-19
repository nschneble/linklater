/**
 * Capitalizes the first character of a string. Used to normalize error
 * messages that may arrive in lowercase from the server.
 */
export function capitalizeFirst(message: string): string {
  if (!message) return message;
  return message.charAt(0).toUpperCase() + message.slice(1);
}
