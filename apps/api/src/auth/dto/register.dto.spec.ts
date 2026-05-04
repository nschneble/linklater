import { validate } from 'class-validator';
import { RegisterDto } from './register.dto.js';

const makeDto = (overrides: Partial<RegisterDto> = {}) =>
  Object.assign(new RegisterDto(), {
    email: 'user@example.com',
    password: 'strong-password-123',
    ...overrides,
  });

describe('RegisterDto', () => {
  it('accepts valid email and password of at least 12 characters', async () => {
    const errors = await validate(makeDto());
    expect(errors).toHaveLength(0);
  });

  it('rejects passwords shorter than 12 characters', async () => {
    const errors = await validate(makeDto({ password: 'short789' }));
    const passwordErrors = errors.filter((error) => error.property === 'password');
    expect(passwordErrors.length).toBeGreaterThan(0);
  });

  it('rejects invalid email addresses', async () => {
    const errors = await validate(makeDto({ email: 'not-an-email' }));
    const emailErrors = errors.filter((error) => error.property === 'email');
    expect(emailErrors.length).toBeGreaterThan(0);
  });
});
