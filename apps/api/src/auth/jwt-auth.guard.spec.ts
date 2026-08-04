import { JwtAuthGuard } from './jwt-auth.guard.js';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('passes a normal user through unchanged', () => {
    const user = { userId: 'user-1', email: 'user@example.com' };
    expect(guard.handleRequest(null, user, null)).toBe(user);
  });

  it('throws UnauthorizedException when token has mfaPending: true', () => {
    const user = {
      userId: 'user-1',
      email: 'user@example.com',
      mfaPending: true,
    };
    expect(() => guard.handleRequest(null, user, null)).toThrow(
      UnauthorizedException,
    );
  });

  it('throws when no user is present', () => {
    expect(() => guard.handleRequest(null, null, null)).toThrow(
      UnauthorizedException,
    );
  });

  it('re-throws an existing error', () => {
    const error = new Error('Token expired');
    expect(() => guard.handleRequest(error, null, null)).toThrow(error);
  });
});
