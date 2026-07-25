import { toOptionalBoolean, toOptionalInteger } from './query-transforms.js';
import type { TransformFnParams } from 'class-transformer';

// The transforms only read `value`, so a minimal parameters object is enough
// to exercise every branch of the coercion.
function makeParameters(value: unknown): TransformFnParams {
  return { value } as unknown as TransformFnParams;
}

describe('toOptionalInteger', () => {
  it('returns undefined for an absent value when no default is given', () => {
    const transform = toOptionalInteger();
    expect(transform(makeParameters(undefined))).toBeUndefined();
  });

  it('returns the supplied default for an absent value', () => {
    const transform = toOptionalInteger(3);
    expect(transform(makeParameters(undefined))).toBe(3);
  });

  it('parses a valid numeric string to an integer', () => {
    const transform = toOptionalInteger();
    expect(transform(makeParameters('25'))).toBe(25);
  });

  it('parses a present value even when a default is configured', () => {
    const transform = toOptionalInteger(3);
    expect(transform(makeParameters('2'))).toBe(2);
  });

  it('yields NaN for a non-numeric value so @IsInt can reject it', () => {
    const transform = toOptionalInteger();
    expect(transform(makeParameters('abc'))).toBeNaN();
  });
});

describe('toOptionalBoolean', () => {
  it("coerces the literal 'true' to boolean true", () => {
    expect(toOptionalBoolean(makeParameters('true'))).toBe(true);
  });

  it("coerces the literal 'false' to boolean false", () => {
    expect(toOptionalBoolean(makeParameters('false'))).toBe(false);
  });

  it('passes a non-boolean value through unchanged so @IsBoolean can reject it', () => {
    expect(toOptionalBoolean(makeParameters('maybe'))).toBe('maybe');
  });

  it('passes an absent value through unchanged (undefined)', () => {
    expect(toOptionalBoolean(makeParameters(undefined))).toBeUndefined();
  });
});
