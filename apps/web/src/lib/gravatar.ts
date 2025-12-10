import md5 from 'blueimp-md5';

export function gravatarUrl(email: string, size = 80): string {
  const normalized = email.trim().toLowerCase();
  const hash = md5(normalized);
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}
