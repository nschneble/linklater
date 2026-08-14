/*
 * Whether a standing failure and a live mismatch ever coexist.
 *
 * The finished DOM cannot answer it. Clearing the failure in the commit
 * that raises the mismatch and clearing it in a commit of its own leave
 * exactly the same markup behind; what differs is whether the document
 * passed through a state where the card told the user to try again and
 * the control it names was already refusing. On the assertive channel
 * that state is an utterance, not a frame.
 *
 * So the oracle is the sequence of commits, recorded by an effect with no
 * dependency array, which React runs once per commit. A render counter
 * would be the wrong unit: React can render without committing, and the
 * screen reader sees commits.
 *
 * What is asked of that sequence is that no commit in it carries both,
 * rather than that it holds one commit. The identity arm cannot hold one:
 * a prop change commits before the effect it triggers can run, so its
 * first commit is the state as it already was. That commit is not the
 * defect, since the mismatch is not up in it yet.
 *
 * Each case seeds a real failure first. `setFailure(null)` against a null
 * value bails out without committing, so a case that skips the seeding
 * passes against a hook that clears nothing at all.
 */

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStoredToken, setStoredToken } from '../../lib/api';
import { useEffect } from 'react';
import { useExtensionAuthorize } from './useExtensionAuthorize';
import type { AuthorizeFailure } from './extensionAuthorizeMessages';

vi.mock('../../lib/api', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, authorizeExtension: vi.fn() };
});

const { authorizeExtension } = await import('../../lib/api');

const CODE_CHALLENGE = 'challenge';
const REDIRECT_URI = 'https://abc.chromiumapp.org/';

// { sub, exp } payloads; the guard reads the subject and nothing else
const ALICE_TOKEN = tokenFor('alice');
const BOB_TOKEN = tokenFor('bob');

function tokenFor(subject: string): string {
  const payload = btoa(
    JSON.stringify({ sub: subject, exp: Math.floor(Date.now() / 1000) + 3600 }),
  );
  return `header.${payload}.signature`;
}

interface Snapshot {
  failure: AuthorizeFailure | null;
  mismatched: boolean;
}

const commits: Snapshot[] = [];

function Probe({ userId }: { userId: string | null }) {
  const { failure, handleAuthorize, mismatched } = useExtensionAuthorize(
    CODE_CHALLENGE,
    REDIRECT_URI,
    userId,
  );
  useEffect(() => {
    commits.push({ failure, mismatched });
  });
  pressAuthorize = handleAuthorize;
  return null;
}

let pressAuthorize: () => Promise<void> = async () => {};

function signInElsewhere(token: string): void {
  window.localStorage.setItem('linklater_token', token);
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'linklater_token',
        newValue: token,
      }),
    );
  });
}

/** Commits where the card asked for a retry the control was refusing. */
function contradictionsSince(mark: number): Snapshot[] {
  return commits
    .slice(mark)
    .filter((commit) => commit.mismatched && commit.failure !== null);
}

/** Puts a real failure in state, so the clear below has something to do. */
async function seedFailure(): Promise<void> {
  vi.mocked(authorizeExtension).mockRejectedValueOnce(new Error('502'));
  await act(async () => {
    await pressAuthorize();
  });
  expect(commits.at(-1)?.failure).not.toBeNull();
}

beforeEach(() => {
  commits.length = 0;
  vi.clearAllMocks();
  window.localStorage.clear();
  setStoredToken(ALICE_TOKEN);
});

afterEach(() => {
  clearStoredToken();
  window.localStorage.clear();
});

describe('useExtensionAuthorize commit sequence', () => {
  it('never commits a standing failure beside a fresh mismatch, on the sibling arm', async () => {
    render(<Probe userId="alice" />);
    await seedFailure();
    const mark = commits.length;

    signInElsewhere(BOB_TOKEN);

    expect(contradictionsSince(mark)).toEqual([]);
    expect(commits.at(-1)).toEqual({ failure: null, mismatched: true });
  });

  it('never commits a standing failure beside a fresh mismatch, on the click arm', async () => {
    render(<Probe userId="alice" />);
    await seedFailure();
    // the tab that missed the event finds out when it tries to grant
    window.localStorage.setItem('linklater_token', BOB_TOKEN);
    const mark = commits.length;

    await act(async () => {
      await pressAuthorize();
    });

    expect(contradictionsSince(mark)).toEqual([]);
    expect(commits.at(-1)).toEqual({ failure: null, mismatched: true });
  });

  it('never commits a standing failure beside a fresh mismatch, on the identity arm', async () => {
    const { rerender } = render(<Probe userId="alice" />);
    await seedFailure();
    const mark = commits.length;

    // the account behind the page changed without the store being touched
    rerender(<Probe userId="carol" />);

    expect(contradictionsSince(mark)).toEqual([]);
    expect(commits.at(-1)).toEqual({ failure: null, mismatched: true });
  });

  it('sees every commit, so an empty result above is a finding', async () => {
    render(<Probe userId="alice" />);
    await seedFailure();
    const mark = commits.length;

    signInElsewhere(BOB_TOKEN);
    signInElsewhere(ALICE_TOKEN);

    // a one-commit recorder would pass the three above whatever ran
    expect(commits.slice(mark).length).toBeGreaterThan(1);
  });
});
