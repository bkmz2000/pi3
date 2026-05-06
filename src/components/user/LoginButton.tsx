import { useState } from 'react';
import { LoginDialog } from './LoginDialog';

export function LoginButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-blue-500 px-4 py-1.5 text-white hover:bg-blue-600"
      >
        Sign In
      </button>
      <LoginDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
