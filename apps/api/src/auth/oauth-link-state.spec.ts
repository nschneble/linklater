import { generateLinkState, verifyLinkState } from './oauth-link-state';

const SECRET = 'test-secret-abc123';
const USER_ID = 'user-abc-123';
const FIVE_MINUTES_MS = 5 * 60 * 1000;

describe('generateLinkState / verifyLinkState', () => {
  describe('generateLinkState', () => {
    it('returns a non-empty string', () => {
      const state = generateLinkState(USER_ID, SECRET);
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
    });

    it('embeds the userId in the state', () => {
      const state = generateLinkState(USER_ID, SECRET);
      const result = verifyLinkState(state, SECRET, FIVE_MINUTES_MS);
      expect(result).toBe(USER_ID);
    });
  });

  describe('verifyLinkState', () => {
    it('returns the userId for a freshly generated state', () => {
      const state = generateLinkState(USER_ID, SECRET);
      const result = verifyLinkState(state, SECRET, FIVE_MINUTES_MS);
      expect(result).toBe(USER_ID);
    });

    it('returns null when the state has exceeded maxAgeMs', () => {
      const state = generateLinkState(USER_ID, SECRET);
      const result = verifyLinkState(state, SECRET, -1);
      expect(result).toBeNull();
    });

    it('returns null when the HMAC has been tampered with', () => {
      const state = generateLinkState(USER_ID, SECRET);
      const tampered = state.slice(0, -4) + 'aaaa';
      const result = verifyLinkState(tampered, SECRET, FIVE_MINUTES_MS);
      expect(result).toBeNull();
    });

    it('returns null for a completely malformed state string', () => {
      expect(verifyLinkState('not-valid', SECRET, FIVE_MINUTES_MS)).toBeNull();
    });

    it('returns null when the secret is wrong', () => {
      const state = generateLinkState(USER_ID, SECRET);
      const result = verifyLinkState(state, 'wrong-secret', FIVE_MINUTES_MS);
      expect(result).toBeNull();
    });
  });
});
