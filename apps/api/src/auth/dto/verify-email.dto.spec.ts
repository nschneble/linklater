import { validate } from 'class-validator';
import { VerifyEmailDto } from './verify-email.dto.js';

const makeDto = (overrides: Partial<VerifyEmailDto> = {}) =>
  Object.assign(new VerifyEmailDto(), {
    token: 'some-valid-token',
    ...overrides,
  });

describe('VerifyEmailDto', () => {
  it('accepts a valid string token', async () => {
    const errors = await validate(makeDto());
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing token', async () => {
    const dto = new VerifyEmailDto();
    const errors = await validate(dto);
    const tokenErrors = errors.filter((error) => error.property === 'token');
    expect(tokenErrors.length).toBeGreaterThan(0);
  });

  it('rejects a non-string token', async () => {
    const dto = Object.assign(new VerifyEmailDto(), { token: 12345 });
    const errors = await validate(dto);
    const tokenErrors = errors.filter((error) => error.property === 'token');
    expect(tokenErrors.length).toBeGreaterThan(0);
  });
});
