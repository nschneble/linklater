import { useCallback, useState } from 'react';
import PrimaryButton from '../common/PrimaryButton';

interface RecoveryCodesModalProps {
  codes: string[];
  onConfirm: () => void;
}

export default function RecoveryCodesModal({
  codes,
  onConfirm,
}: RecoveryCodesModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [codes]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-codes-title"
    >
      <div className="w-full max-w-md mx-4 p-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl space-y-4">
        <h3
          id="recovery-codes-title"
          className="text-[var(--text)] text-lg font-semibold"
        >
          Save your recovery codes
        </h3>
        <p className="text-[var(--text-muted)] text-sm">
          Store these codes somewhere safe. Each can be used once to access your
          account if you lose your 2FA device.
        </p>
        <ul className="grid grid-cols-2 gap-2">
          {codes.map((code) => (
            <li
              key={code}
              className="px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-mono rounded"
            >
              {code}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs hover:text-[var(--text)] transition"
        >
          <i
            className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'} text-[0.65rem]`}
            aria-hidden="true"
          />
          {copied ? 'Copied!' : 'Copy all codes'}
        </button>
        <PrimaryButton className="w-full py-2.5" onClick={onConfirm}>
          I&apos;ve saved these codes
        </PrimaryButton>
      </div>
    </div>
  );
}
