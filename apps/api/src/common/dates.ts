export function expiresInMs(ms: number): Date {
  return new Date(Date.now() + ms);
}
