import { jest } from '@jest/globals';
import {
  parseArguments,
  verifiedRecipientWhere,
} from './announce-policy-update.args.js';

const USAGE =
  'Usage: announce-policy-update --effective-date "<human-readable date>" [--dry-run]';

describe('announce-policy-update args', () => {
  describe('parseArguments', () => {
    let exitSpy: jest.SpiedFunction<typeof process.exit>;
    let errorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
      jest.clearAllMocks();

      exitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation((_code?: number | string | null) => {
          throw new Error('process.exit called');
        }) as unknown as jest.SpiedFunction<typeof process.exit>;
      errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('parses the effective date and defaults dryRun to false', () => {
      expect(parseArguments(['--effective-date', 'August 15, 2026'])).toEqual({
        effectiveDate: 'August 15, 2026',
        dryRun: false,
      });
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('sets dryRun to true when --dry-run is present', () => {
      expect(
        parseArguments(['--effective-date', 'August 15, 2026', '--dry-run']),
      ).toEqual({ effectiveDate: 'August 15, 2026', dryRun: true });
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('exits with code 1 and prints usage when --effective-date is missing', () => {
      expect(() => parseArguments(['--dry-run'])).toThrow(
        'process.exit called',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(USAGE);
    });

    it('exits with code 1 when --effective-date has no following value', () => {
      expect(() => parseArguments(['--effective-date'])).toThrow(
        'process.exit called',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(USAGE);
    });
  });

  describe('verifiedRecipientWhere', () => {
    it('restricts recipients to accounts with a verified email', () => {
      expect(verifiedRecipientWhere).toEqual({
        emailVerifiedAt: { not: null },
      });
    });
  });
});
