import { api } from './state/api';
import { useUser } from './state/useUser';
import { capturePendingSessionToken } from './state/pendingSession';

let initialized = false;

export function initializeApp() {
  if (initialized) return;
  initialized = true;

  api.setOnUnauthorized(() => {
    useUser.setState({ authState: 'logged_out', user: null });
  });

  // Before any route renders: a join link may have landed anywhere, and its
  // fragment does not survive navigating into the IDE or signing in.
  capturePendingSessionToken();
}
