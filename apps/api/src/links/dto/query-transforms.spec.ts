import { toOptionalInteger } from './query-transforms.js';
import type { TransformFnParams } from 'class-transformer';

// The transform only reads `value`, so a minimal params object is enough to
// exercise every branch of the coercion.
function makeParams(value: unknown): TransformFnParams {
  return { value } as unknown as TransformFnParams;
}

describe('toOptionalInteger', () => {
  it('returns undefined for an absent value when no default is given', () => {
    const transform = toOptionalInteger();
    expect(transform(makeParams(undefined))).toBeUndefined();
  });

  it('returns the supplied default for an absent value', () => {
    const transform = toOptionalInteger(3);
    expect(transform(makeParams(undefined))).toBe(3);
  });

  it('parses a valid numeric string to an integer', () => {
    const transform = toOptionalInteger();
    expect(transform(makeParams('25'))).toBe(25);
  });

  it('parses a present value even when a default is configured', () => {
    const transform = toOptionalInteger(3);
    expect(transform(makeParams('2'))).toBe(2);
  });

  it('yields NaN for a non-numeric value so @IsInt can reject it', () => {
    const transform = toOptionalInteger();
    expect(transform(makeParams('abc'))).toBeNaN();
  });
});
