import LinkButton from '../common/LinkButton';

interface MfaChallengeSwitchProps {
  isRecovery: boolean;
  onSwitchToRecovery: () => void;
  onSwitchToTotp: () => void;
}

export default function MfaChallengeSwitch({
  isRecovery,
  onSwitchToRecovery,
  onSwitchToTotp,
}: MfaChallengeSwitchProps) {
  return (
    <div className="flex flex-col items-center gap-2 mt-4 text-center">
      {!isRecovery && (
        <LinkButton onClick={onSwitchToRecovery}>
          Use a recovery code
        </LinkButton>
      )}
      {isRecovery && (
        <LinkButton onClick={onSwitchToTotp}>Use a different method</LinkButton>
      )}
    </div>
  );
}
