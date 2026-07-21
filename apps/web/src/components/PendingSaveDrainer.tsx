import { usePendingSaveDrain } from '../lib/hooks/usePendingSaveDrain';
import Toast from './common/Toast';

/**
 * Hosts the pending-save drainer and its single success toast.
 *
 * App mounts this only when a user is present, so the drain never runs for a
 * logged-out visitor. Renders nothing until a drained save produces a message.
 */
export default function PendingSaveDrainer() {
  const { toastMessage, dismissToast } = usePendingSaveDrain();

  if (!toastMessage) return null;

  return <Toast message={toastMessage} onDismiss={dismissToast} />;
}
