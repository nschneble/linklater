import { withoutPasswordHash } from './users.utils.js';

describe('withoutPasswordHash', () => {
  it('removes passwordHash from a user object', () => {
    const user = {
      id: 'user-1',
      email: 'alice@example.com',
      passwordHash: 'hashed-secret',
    };

    const result = withoutPasswordHash(user);

    expect(result).toEqual({ id: 'user-1', email: 'alice@example.com' });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('does not mutate the original object', () => {
    const user = { id: 'user-2', passwordHash: 'secret' };

    withoutPasswordHash(user);

    expect(user.passwordHash).toBe('secret');
  });

  it('preserves all non-passwordHash fields', () => {
    const user = {
      id: 'user-3',
      email: 'bob@example.com',
      createdAt: new Date('2025-01-01'),
      emailVerifiedAt: null,
      passwordHash: 'hash',
    };

    const result = withoutPasswordHash(user);

    expect(result).toMatchObject({
      id: 'user-3',
      email: 'bob@example.com',
      createdAt: new Date('2025-01-01'),
      emailVerifiedAt: null,
    });
  });

  it('works when passwordHash is null', () => {
    const user = {
      id: 'user-4',
      email: 'carol@example.com',
      passwordHash: null,
    };

    const result = withoutPasswordHash(user);

    expect(result).toEqual({ id: 'user-4', email: 'carol@example.com' });
    expect(result).not.toHaveProperty('passwordHash');
  });
});
