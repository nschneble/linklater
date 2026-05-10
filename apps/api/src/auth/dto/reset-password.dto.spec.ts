import { ResetPasswordDto } from './reset-password.dto.js';
import { validate } from 'class-validator';

const makeDto = (overrides: Partial<ResetPasswordDto> = {}) =>
  Object.assign(new ResetPasswordDto(), {
    token: 'some-valid-token',
    password: 'super-strong-password-123-!',
    ...overrides,
  });

describe('ResetPasswordDto', () => {
  it('accepts a valid token and password', async () => {
    const errors = await validate(makeDto());
    expect(errors).toHaveLength(0);
  });

  it('rejects a password shorter than 12 characters', async () => {
    const errors = await validate(makeDto({ password: 'too-short' }));
    const passwordErrors = errors.filter(
      (error) => error.property === 'password',
    );
    expect(passwordErrors.length).toBeGreaterThan(0);
  });

  it('rejects a missing token', async () => {
    const dto = new ResetPasswordDto();
    dto.password = 'strong-password-123';
    const errors = await validate(dto);
    const tokenErrors = errors.filter((error) => error.property === 'token');
    expect(tokenErrors.length).toBeGreaterThan(0);
  });

  it('rejects a missing password', async () => {
    const dto = new ResetPasswordDto();
    dto.token = 'some-valid-token';
    const errors = await validate(dto);
    const passwordErrors = errors.filter(
      (error) => error.property === 'password',
    );
    expect(passwordErrors.length).toBeGreaterThan(0);
  });
});
