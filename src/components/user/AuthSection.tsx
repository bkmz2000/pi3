import { useUser } from '../../state/useUser';
import { LoginButton } from './LoginButton';
import { UserMenu } from './UserMenu';

export function AuthSection() {
  const { authState } = useUser();

  if (authState === 'loading') {
    return (
      <div className="flex h-8 w-8 items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
      </div>
    );
  }

  if (authState === 'logged_in') {
    return <UserMenu />;
  }

  return <LoginButton />;
}
