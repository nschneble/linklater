import { validate } from 'class-validator';
import { RequestEmailChangeDto } from './request-email-change.dto.js';

const makeDto = (overrides: Partial<RequestEmailChangeDto> = {}) =>
  Object.assign(new RequestEmailChangeDto(), {
    email: 'new.email@example.com',
    ...overrides,
  });

describe('RequestEmailChangeDto', () => {
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
    const dto = new RequestEmailChangeDto();
    const errors = await validate(dto);
    const emailErrors = errors.filter((error) => error.property === 'email');
    expect(emailErrors.length).toBeGreaterThan(0);
  });
});
