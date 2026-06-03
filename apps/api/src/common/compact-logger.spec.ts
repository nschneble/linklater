import { CompactLogger } from './compact-logger.js';

describe('CompactLogger', () => {
  let logger: CompactLogger;

  beforeEach(() => {
    logger = new CompactLogger();
  });

  describe('getTimestamp', () => {
    it('returns a timestamp in YYYY-MM-DD HH.MM.SS format', () => {
      const timestamp = (
        logger as unknown as { getTimestamp: () => string }
      ).getTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2}$/);
    });

    it('reflects the current date', () => {
      const before = new Date();
      const timestamp = (
        logger as unknown as { getTimestamp: () => string }
      ).getTimestamp();
      const after = new Date();

      const expectedDate = before.toISOString().slice(0, 10);
      expect(timestamp.startsWith(expectedDate)).toBe(true);

      const timePart = timestamp.slice(11);
      const [hours, minutes] = timePart.split('.').map(Number);
      expect(hours).toBeGreaterThanOrEqual(before.getHours());
      expect(hours).toBeLessThanOrEqual(after.getHours());
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeLessThanOrEqual(59);
    });
  });

  describe('formatPid', () => {
    it('includes the pid number in the output', () => {
      const formatted = (
        logger as unknown as { formatPid: (pid: number) => string }
      ).formatPid(12345);
      expect(formatted).toContain('12345');
    });

    it('includes the Nest label', () => {
      const formatted = (
        logger as unknown as { formatPid: (pid: number) => string }
      ).formatPid(1);
      expect(formatted).toContain('Nest');
    });

    it('wraps output in ANSI color codes', () => {
      const formatted = (
        logger as unknown as { formatPid: (pid: number) => string }
      ).formatPid(1);
      expect(formatted).toContain('\x1B[37m');
      expect(formatted).toContain('\x1B[39m');
    });
  });
});
