/**
 * SaveErrorIndicator: the floating save-state chip. State-driven branches:
 * saving, auth/network/quota/payload errors, example-session local-only,
 * clean named project — and null when there is no project.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

const ideState = {
  saveError: null as { kind: string; message: string } | null,
  isSaving: false,
};
const editorState = {
  currentProjectId: 'p1' as string | undefined,
  dirtyFiles: new Set<string>(),
};

jest.mock('../../src/state/IdeState', () => ({
  useIde: (selector: (s: unknown) => unknown) => selector(ideState),
  useEditor: (selector: (s: unknown) => unknown) => selector(editorState),
  isExampleSessionId: (id: string | null | undefined) =>
    typeof id === 'string' && id.startsWith('__example_session_'),
}));

// i18next renders t() as the key when no instance is configured.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { SaveErrorIndicator } from '../../src/components/SaveErrorIndicator';

beforeEach(() => {
  ideState.saveError = null;
  ideState.isSaving = false;
  editorState.currentProjectId = 'p1';
  editorState.dirtyFiles = new Set();
});

afterEach(cleanup);

describe('SaveErrorIndicator', () => {
  test('renders nothing without a project', () => {
    editorState.currentProjectId = undefined;
    const { container } = render(<SaveErrorIndicator />);
    expect(container.firstChild).toBeNull();
  });

  test('shows saving chip while saving', () => {
    ideState.isSaving = true;
    render(<SaveErrorIndicator />);
    expect(screen.getByText('saveIndicator.saving')).toBeTruthy();
  });

  test('shows auth chip on auth error', () => {
    ideState.saveError = { kind: 'auth', message: 'x' };
    render(<SaveErrorIndicator />);
    expect(screen.getByText('saveIndicator.savedLocallySignIn')).toBeTruthy();
  });

  test('shows network chip on network error', () => {
    ideState.saveError = { kind: 'network', message: 'x' };
    render(<SaveErrorIndicator />);
    expect(screen.getByText('saveIndicator.savedOfflineWillSync')).toBeTruthy();
  });

  test('shows the quota message verbatim', () => {
    ideState.saveError = { kind: 'quota', message: 'Local storage full — sign in to save your work' };
    render(<SaveErrorIndicator />);
    expect(screen.getByText('Local storage full — sign in to save your work')).toBeTruthy();
  });

  test('shows the payload message verbatim', () => {
    ideState.saveError = { kind: 'payload', message: 'Project too large' };
    render(<SaveErrorIndicator />);
    expect(screen.getByText('Project too large')).toBeTruthy();
  });

  test('example session with dirty files shows local-only', () => {
    editorState.currentProjectId = '__example_session_flappy';
    editorState.dirtyFiles = new Set(['main.py']);
    render(<SaveErrorIndicator />);
    expect(screen.getByText('saveIndicator.localOnly')).toBeTruthy();
  });

  test('example session clean renders nothing', () => {
    editorState.currentProjectId = '__example_session_flappy';
    const { container } = render(<SaveErrorIndicator />);
    expect(container.firstChild).toBeNull();
  });

  test('clean named project shows saved chip', () => {
    render(<SaveErrorIndicator />);
    expect(screen.getByText('saveIndicator.saved')).toBeTruthy();
  });

  test('dirty named project renders nothing (no chip for unsaved state)', () => {
    editorState.dirtyFiles = new Set(['main.py']);
    const { container } = render(<SaveErrorIndicator />);
    expect(container.firstChild).toBeNull();
  });
});
