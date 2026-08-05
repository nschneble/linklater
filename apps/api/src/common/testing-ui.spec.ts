import { isTestingUi, assertTestingUiNotInProduction } from './testing-ui.js';
import { jest } from '@jest/globals';

describe('isTestingUi', () => {
  const originalEnv = process.env.TESTING_UI;

  afterEach(() => {
    process.env.TESTING_UI = originalEnv;
  });

  it('returns true when TESTING_UI is "1"', () => {
    process.env.TESTING_UI = '1';
    expect(isTestingUi()).toBe(true);
  });

  it('returns false when TESTING_UI is unset', () => {
    delete process.env.TESTING_UI;
    expect(isTestingUi()).toBe(false);
  });

  it('returns false when TESTING_UI is any other value', () => {
    process.env.TESTING_UI = 'true';
    expect(isTestingUi()).toBe(false);
  });
});

describe('assertTestingUiNotInProduction', () => {
  const originalTestingUi = process.env.TESTING_UI;
  const originalNodeEnv = process.env.NODE_ENV;

  let exitSpy: jest.SpiedFunction<typeof process.exit>;
  let errorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((_code?: number | string | null) => {
        throw new Error('process.exit called');
      }) as unknown as jest.SpiedFunction<typeof process.exit>;
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.TESTING_UI = originalTestingUi;
    process.env.NODE_ENV = originalNodeEnv;
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('exits when TESTING_UI=1 and NODE_ENV=production', () => {
    process.env.TESTING_UI = '1';
    process.env.NODE_ENV = 'production';

    expect(() => assertTestingUiNotInProduction()).toThrow(
      'process.exit called',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('TESTING_UI=1 is not allowed in production'),
    );
  });

  it('does not exit when TESTING_UI=1 and NODE_ENV is development', () => {
    process.env.TESTING_UI = '1';
    process.env.NODE_ENV = 'development';

    expect(() => assertTestingUiNotInProduction()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('does not exit when TESTING_UI is unset and NODE_ENV=production', () => {
    delete process.env.TESTING_UI;
    process.env.NODE_ENV = 'production';

    expect(() => assertTestingUiNotInProduction()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('does not exit when neither flag is set', () => {
    delete process.env.TESTING_UI;
    delete process.env.NODE_ENV;

    expect(() => assertTestingUiNotInProduction()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
