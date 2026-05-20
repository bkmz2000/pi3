import { api } from './state/api';
import { useUser } from './state/useUser';

let initialized = false;

export function initializeApp() {
  if (initialized) return;
  initialized = true;

  api.setOnUnauthorized(() => {
    useUser.setState({ authState: 'logged_out', user: null });
  });
}
