import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('returns the error message when given an Error instance', () => {
    const error = new Error('something broke');
    expect(getErrorMessage(error)).toBe('something broke');
  });

  it('returns the custom fallback when error is a plain string', () => {
    expect(getErrorMessage('oops', 'fallback message')).toBe(
      'fallback message',
    );
  });

  it('returns the custom fallback when error is null', () => {
    expect(getErrorMessage(null, 'fallback message')).toBe('fallback message');
  });

  it('returns the custom fallback when error is undefined', () => {
    expect(getErrorMessage(undefined, 'fallback message')).toBe(
      'fallback message',
    );
  });

  it('returns default fallback when no fallback provided and error is not an Error', () => {
    expect(getErrorMessage({ code: 42 })).toBe('Something went wrong');
  });
});
