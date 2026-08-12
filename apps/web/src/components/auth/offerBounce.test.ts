/**
 * Unit tests for offerBounce.
 *
 * Storage is real throughout: every guard here is a question about what
 * storage answers, and the whole defect this replaces was a predicate
 * that asked a different question than the one it reported on.
 *
 * The tree-level play of the same claims, through the auth gate that
 * calls this, lives in `routes/Unauthenticated.test.tsx`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { announceOfferBounce } from './offerBounce';
import { clearStoredToken } from '../../lib/api';
import {
  consumePendingNotice,
  setPendingNotice,
} from '../../lib/pendingNotice';
import { JwtService } from '@nestjs/jwt';

const CARRIED_EMAIL_KEY = 'linklater_carried_email';
const RENDERED_IDENTITY_KEY = 'linklater_rendered_identity';
const TOKEN_KEY = 'linklater_token';

const BOUNCE_MESSAGE = "We couldn't get you back into that session";

const jwt = new JwtService({ secret: 'offer-bounce-test-secret' });

function theOfferWasFollowed(email = 'half-typed@example.com') {
  window.sessionStorage.setItem(CARRIED_EMAIL_KEY, email);
}

function theOfferIsStillStanding() {
  window.sessionStorage.setItem(RENDERED_IDENTITY_KEY, 'user-1');
  window.localStorage.setItem(
    TOKEN_KEY,
    jwt.sign({ subject: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 }),
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearStoredToken();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearStoredToken();
});

describe('a load that followed the offer and came back', () => {
  it('queues the explanation the arrival would otherwise not have', () => {
    theOfferWasFollowed();

    announceOfferBounce();

    expect(consumePendingNotice()?.message).toBe(BOUNCE_MESSAGE);
  });

  it('queues it for an empty box too, since the arrival still needs saying', () => {
    theOfferWasFollowed('');

    announceOfferBounce();

    expect(consumePendingNotice()?.message).toBe(BOUNCE_MESSAGE);
  });
});

describe('a load that never followed the offer', () => {
  it('says nothing, since no session was ever being returned to', () => {
    announceOfferBounce();

    expect(consumePendingNotice()).toBeNull();
  });
});

describe('an offer that is still standing behind the arrival', () => {
  it('says nothing, so its own region is not contradicted', () => {
    theOfferWasFollowed();
    theOfferIsStillStanding();

    announceOfferBounce();

    expect(consumePendingNotice()).toBeNull();
  });

  it('is the standing offer deciding it, not the carry going missing', () => {
    theOfferWasFollowed();
    theOfferIsStillStanding();
    announceOfferBounce();
    expect(consumePendingNotice()).toBeNull();

    localStorage.clear();
    clearStoredToken();
    announceOfferBounce();

    expect(consumePendingNotice()?.message).toBe(BOUNCE_MESSAGE);
  });
});

// a second run of the gate meets the same guard as another flow's message
// does, since the guard never asks whose the queued one is; the pin is
// `leaves an error-variant notice alone rather than demoting it` below
describe('a message another flow already queued', () => {
  it('leaves an error-variant notice alone rather than demoting it', () => {
    setPendingNotice('login-link-invalid');
    theOfferWasFollowed();

    announceOfferBounce();

    const surviving = consumePendingNotice();
    expect(surviving?.message).toBe('Login link has expired');
    expect(surviving?.variant).toBe('error');
  });

  it('leaves a success-variant notice alone as well', () => {
    setPendingNotice('account-deleted');
    theOfferWasFollowed();

    announceOfferBounce();

    expect(consumePendingNotice()?.message).toBe(
      'Your account has been deleted.',
    );
  });
});
