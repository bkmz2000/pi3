/**
 * ErrorCard (ConsolePanel): renders a runtime error with category
 * color/icon, title + message (i18n-key or raw), blocking badge, and
 * one-click suggestion application.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

const runnerState = {
  applySuggestion: jest.fn(),
};

jest.mock('../../src/runner/RunnerProvider', () => ({
  useRunner: () => runnerState,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, args?: Record<string, unknown>) =>
      k === 'friendlyError.blocksRunning' ? 'BLOCKS' : (args ? k + ':' + JSON.stringify(args) : k),
  }),
}));

import { ErrorCard } from '../../src/components/ConsolePanel';
import type { RuntimeError } from '../../src/runner/WorkerInterface';

function mkError(overrides: Partial<RuntimeError> = {}): RuntimeError {
  return {
    category: 'grammar',
    title: 'Syntax error',
    titleKey: undefined,
    message: 'missing colon',
    messageKey: 'linter.E999Colon',
    messageArgs: { line: 3 },
    isBlocking: true,
    line: 3,
    token: 'x',
    suggestions: [],
    ...overrides,
  } as RuntimeError;
}

afterEach(cleanup);

describe('ErrorCard', () => {
  test('renders title, message, and blocking badge', () => {
    render(<ErrorCard error={mkError()} />);
    expect(screen.getByText('linter.E999Colon:{"line":3}')).toBeTruthy();
    expect(screen.getByText('BLOCKS')).toBeTruthy();
    expect(document.querySelector('[data-error-card]')).toBeTruthy();
  });

  test('falls back to raw message when no i18n key', () => {
    render(<ErrorCard error={mkError({ messageKey: undefined, titleKey: undefined })} />);
    expect(screen.getByText('missing colon')).toBeTruthy();
  });

  test('applies a suggestion by clicking the candidate chip', () => {
    render(<ErrorCard error={mkError({ suggestions: [{ token: 'x', candidates: ['y', 'z'] }] })} />);
    fireEvent.click(screen.getByText('y'));
    expect(runnerState.applySuggestion).toHaveBeenCalledWith('x', 'y');
    // Applying one candidate for a token hides ALL its chips (appliedTokens
    // keys on the token, not the candidate).
    expect(screen.queryByText('y')).toBeNull();
    expect(screen.queryByText('z')).toBeNull();
  });
});