/**
 * Strips the `passwordHash` field from any user-shaped object before returning
 * it to callers. This ensures password hashes never leave the service layer,
 * regardless of how the user object was fetched.
 *
 * The generic constraint `T extends { passwordHash: unknown }` means this
 * works on any object that has a `passwordHash` field, including raw Prisma
 * User records and custom projection types.
 *
 * @param user - Any object containing a `passwordHash` field.
 * @returns A copy of `user` with `passwordHash` omitted.
 */
export function withoutPasswordHash<T extends { passwordHash: unknown }>(
  user: T,
): Omit<T, 'passwordHash'> {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}
