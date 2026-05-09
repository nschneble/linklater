import { ForgotPasswordDto } from './forgot-password.dto.js';
import { validate } from 'class-validator';

const makeDto = (overrides: Partial<ForgotPasswordDto> = {}) =>
  Object.assign(new ForgotPasswordDto(), {
    email: 'user@example.com',
    ...overrides,
  });

describe('ForgotPasswordDto', () => {
  it('accepts a valid email address', async () => {
    const errors = await validate(makeDto());
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email address', async () => {
    const errors = await validate(makeDto({ email: 'not-an-email' }));
    const emailErrors = errors.filter((error) => error.property === 'email');
    expect(emailErrors.length).toBeGreaterThan(0);
  });

  it('rejects a missing email', async () => {
    const dto = new ForgotPasswordDto();
    const errors = await validate(dto);
    const emailErrors = errors.filter((error) => error.property === 'email');
    expect(emailErrors.length).toBeGreaterThan(0);
  });
});
