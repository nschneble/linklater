import { RefreshTokenDto } from './refresh-token.dto.js';
import { validate } from 'class-validator';

const makeDto = (overrides: Partial<RefreshTokenDto> = {}) =>
  Object.assign(new RefreshTokenDto(), {
    refreshToken: 'a'.repeat(64),
    ...overrides,
  });

const errorsFor = async (dto: RefreshTokenDto, property: string) =>
  (await validate(dto)).filter((error) => error.property === property);

describe('RefreshTokenDto', () => {
  it('accepts a body carrying only the refresh token', async () => {
    const errors = await validate(makeDto());
    expect(errors).toHaveLength(0);
  });

  it('accepts a nominated successor of 64 lowercase hex characters', async () => {
    const dto = makeDto({
      nextRefreshToken: 'b'.repeat(32) + '0123456789abcdef'.repeat(2),
    });

    expect(await errorsFor(dto, 'nextRefreshToken')).toHaveLength(0);
  });

  // a pattern pins shape, never entropy; a weak successor is self-harm
  it.each([
    ['uppercase hex', 'A'.repeat(64)],
    ['63 characters', 'a'.repeat(63)],
    ['65 characters', 'a'.repeat(65)],
    ['non-hex characters', 'z'.repeat(64)],
    ['an empty string', ''],
  ])(
    'rejects a nominated successor of %s',
    async (_label, nextRefreshToken) => {
      const dto = makeDto({ nextRefreshToken });

      expect((await errorsFor(dto, 'nextRefreshToken')).length).toBeGreaterThan(
        0,
      );
    },
  );

  it('rejects a non-string nominated successor', async () => {
    const dto = Object.assign(makeDto(), { nextRefreshToken: 12345 });

    expect(
      (await errorsFor(dto as RefreshTokenDto, 'nextRefreshToken')).length,
    ).toBeGreaterThan(0);
  });

  // both coerce past a bare regex test, so only the typeof guard rejects
  it.each([
    ['an array wrapping one', ['a'.repeat(64)]],
    ['an object stringifying to one', { toString: () => 'a'.repeat(64) }],
  ])(
    'rejects a nominated successor given as %s',
    async (_label, nextRefreshToken) => {
      const dto = Object.assign(makeDto(), { nextRefreshToken });

      expect(
        (await errorsFor(dto as RefreshTokenDto, 'nextRefreshToken')).length,
      ).toBeGreaterThan(0);
    },
  );
});
