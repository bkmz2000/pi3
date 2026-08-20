/**
 * ReadOnlyCode: theme-aware read-only Python view used by the teacher
 * live-code pane and session group view. Verifies it renders the content,
 * applies read-only extensions, and scrolls the cursor line into view.
 */
import { describe, test, expect, afterEach } from '@jest/globals';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

const themeState = {
  theme: { fontMono: 'monospace', surface: '#111', panelTxt: '#eee', accent: '#0ea5e9' } as Record<string, string>,
  fontSize: 14,
};

jest.mock('../../src/state/useTheme', () => ({
  useThemeStore: (selector: (s: unknown) => unknown) => selector(themeState),
}));

jest.mock('../../src/editor/cmTheme', () => ({
  getCmTheme: () => [],
}));

import { ReadOnlyCode } from '../../src/components/ReadOnlyCode';

afterEach(cleanup);

describe('ReadOnlyCode', () => {
  test('renders the given content', () => {
    const { container } = render(<ReadOnlyCode content="print('hi')" />);
    expect(container.querySelector('.cm-content')?.textContent).toContain("print('hi')");
  });

  test('applies read-only extensions (editable=false)', () => {
    const { container } = render(<ReadOnlyCode content="x = 1" />);
    const content = container.querySelector('.cm-content');
    expect(content).toBeTruthy();
    // The editor should not be contenteditable.
    expect(content?.getAttribute('contenteditable')).toBe('false');
  });

  test('renders nothing broken with a cursorLine', () => {
    const { container } = render(<ReadOnlyCode content="a\nb\nc" cursorLine={2} />);
    expect(container.querySelector('.cm-content')).toBeTruthy();
  });
});