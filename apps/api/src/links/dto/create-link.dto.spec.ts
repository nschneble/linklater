import { validate } from 'class-validator';
import { CreateLinkDto } from './create-link.dto.js';

const makeDto = (overrides: Partial<CreateLinkDto> = {}) =>
  Object.assign(new CreateLinkDto(), {
    url: 'https://example.com/article',
    ...overrides,
  });

describe('CreateLinkDto', () => {
  it('accepts a valid https URL', async () => {
    const errors = await validate(makeDto());
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid http URL', async () => {
    const errors = await validate(makeDto({ url: 'http://example.com' }));
    expect(errors).toHaveLength(0);
  });

  it('rejects a plain string that is not a URL', async () => {
    const errors = await validate(makeDto({ url: 'not a url' }));
    const urlErrors = errors.filter((error) => error.property === 'url');
    expect(urlErrors.length).toBeGreaterThan(0);
  });

  it('rejects a missing url', async () => {
    const dto = new CreateLinkDto();
    const errors = await validate(dto);
    const urlErrors = errors.filter((error) => error.property === 'url');
    expect(urlErrors.length).toBeGreaterThan(0);
  });
});
