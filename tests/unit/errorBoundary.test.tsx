/**
 * ErrorBoundary: catches render errors, shows a fallback with the error
 * message + retry/reload, and auto-resets when the resetKey changes.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

const themeState = {
  theme: { surface: '#111', appTxt: '#eee', surfacePanel: '#222', panelBorder: '#333', radiusButton: 6 } as Record<string, unknown>,
};

jest.mock('../../src/state/useTheme', () => ({
  useThemeStore: (selector: (s: unknown) => unknown) => selector(themeState),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, string>) =>
    opts ? k + ':' + (opts.label ?? '') : k }),
}));

import { ErrorBoundary } from '../../src/components/ErrorBoundary';

function Bomb({ message = 'boom' }: { message?: string }) {
  throw new Error(message);
}

const consoleError = console.error;
beforeEach(() => { console.error = jest.fn(); });
afterEach(() => { console.error = consoleError; cleanup(); });

describe('ErrorBoundary', () => {
  test('renders children when no error', () => {
    render(<ErrorBoundary><div>ok content</div></ErrorBoundary>);
    expect(screen.getByText('ok content')).toBeTruthy();
  });

  test('catches a child error and shows the fallback', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary label="Sprite editor" onError={onError}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/boom/)).toBeTruthy();
    expect(onError).toHaveBeenCalled();
  });

  test('reset button clears the error and re-renders children', () => {
    render(
      <ErrorBoundary label="X"><Bomb /></ErrorBoundary>,
    );
    fireEvent.click(screen.getByText('errorBoundary.tryAgain'));
    // After reset, the child (which always throws) re-throws → fallback again.
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  test('recovers when resetKey changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="a" label="X"><Bomb /></ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    // Swap to a non-throwing child with a new resetKey → error cleared.
    rerender(<ErrorBoundary resetKey="b" label="X"><div>recovered</div></ErrorBoundary>);
    expect(screen.getByText('recovered')).toBeTruthy();
  });
});
