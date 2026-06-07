import MfaView from './MfaView';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { FormEvent, RefObject } from 'react';

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

interface HarnessProps {
  loading: boolean;
  mfaChallenge: 'totp' | 'recovery';
  mfaCode: string;
  onSubmit: (event: FormEvent) => void;
}

function Harness({ loading, mfaChallenge, mfaCode, onSubmit }: HarnessProps) {
  const errorReference = useRef<HTMLParagraphElement>(
    null,
  ) as RefObject<HTMLParagraphElement | null>;
  const mfaInputReference = useRef<HTMLInputElement>(
    null,
  ) as RefObject<HTMLInputElement | null>;

  return (
    <MfaView
      error={null}
      errorReference={errorReference}
      loading={loading}
      mfaChallenge={mfaChallenge}
      mfaCode={mfaCode}
      mfaInputReference={mfaInputReference}
      onMfaCodeChange={() => {}}
      onSubmit={onSubmit}
      onSwitchToRecovery={() => {}}
      onSwitchToTotp={() => {}}
    />
  );
}

describe('MfaView auto-submit gating', () => {
  it('auto-submits in TOTP mode once a 6-digit code is entered (positive control)', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());

    const { rerender } = render(
      <Harness
        loading={false}
        mfaChallenge="totp"
        mfaCode=""
        onSubmit={onSubmit}
      />,
    );
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <Harness
        loading={false}
        mfaChallenge="totp"
        mfaCode="123456"
        onSubmit={onSubmit}
      />,
    );
    await waitForAnimationFrame();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not auto-submit while loading, preventing a double-submit if loading flips on mid-type', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());

    const { rerender } = render(
      <Harness
        loading={false}
        mfaChallenge="totp"
        mfaCode="12345"
        onSubmit={onSubmit}
      />,
    );
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <Harness
        loading={true}
        mfaChallenge="totp"
        mfaCode="123456"
        onSubmit={onSubmit}
      />,
    );
    await waitForAnimationFrame();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not auto-submit in recovery mode, even when the entered string happens to be 6 digits', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());

    const { rerender } = render(
      <Harness
        loading={false}
        mfaChallenge="recovery"
        mfaCode=""
        onSubmit={onSubmit}
      />,
    );

    rerender(
      <Harness
        loading={false}
        mfaChallenge="recovery"
        mfaCode="123456"
        onSubmit={onSubmit}
      />,
    );
    await waitForAnimationFrame();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
