import { Modal } from './Modal';

/**
 * Thin wrapper over the shared Modal. Kept for callers that want the
 * legacy padded-card look; new code should use <Modal> directly.
 */
export function ThemedDialog({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal title={title} onClose={onClose} width={440} minWidth={320}>
      <div style={{ padding: 24 }}>{children}</div>
    </Modal>
  );
}
