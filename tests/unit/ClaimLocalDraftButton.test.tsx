import { fireEvent, render, screen } from '@testing-library/react';

import { ClaimLocalDraftButton } from '../../src/components/ClaimLocalDraftButton';

it('offers a claim for a signed-in clean recovery draft without requiring an edit', () => {
  const onClaim = jest.fn();
  render(<ClaimLocalDraftButton projectId="__anon_draft_recovered_42"
    signedIn onClaim={onClaim} />);
  fireEvent.click(screen.getByTestId('claim-local-draft'));
  expect(onClaim).toHaveBeenCalledTimes(1);
});

it('does not offer cloud claiming for a signed-out student or a server project', () => {
  const onClaim = jest.fn();
  const { rerender } = render(<ClaimLocalDraftButton projectId="__anon_draft_42"
    signedIn={false} onClaim={onClaim} />);
  expect(screen.queryByTestId('claim-local-draft')).toBeNull();
  rerender(<ClaimLocalDraftButton projectId="server-id" signedIn onClaim={onClaim} />);
  expect(screen.queryByTestId('claim-local-draft')).toBeNull();
});
