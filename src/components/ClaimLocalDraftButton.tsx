import { useTranslation } from 'react-i18next';

import { isAnonymousDraftId } from '../state/sessionId';

interface ClaimLocalDraftButtonProps {
  projectId: string | null;
  signedIn: boolean;
  onClaim: () => void;
}

/** A clean device-only draft still needs a visible route to verified cloud saving. */
export function ClaimLocalDraftButton({ projectId, signedIn, onClaim }: ClaimLocalDraftButtonProps) {
  const { t } = useTranslation();
  if (!signedIn || !isAnonymousDraftId(projectId)) return null;
  return (
    <button type="button" onClick={onClaim} data-testid="claim-local-draft"
      className="mx-3 my-2 self-start rounded bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-600"
    >
      {t('saveIndicator.claimDraft')}
    </button>
  );
}
