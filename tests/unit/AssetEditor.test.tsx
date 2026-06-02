import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React, { Suspense } from 'react';

jest.mock('../../src/SheetEditor', () => {
  const R = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: ({ onClose }: { onClose: () => void }) =>
      R.createElement('div', { 'data-testid': 'sheet-editor' },
        R.createElement('button', { onClick: onClose }, 'Close'),
      ),
    PAL_NAMES: {},
  };
});

jest.mock('../../src/TileEditor', () => {
  const R = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: ({ onClose, onSave }: { onClose: () => void; onSave: () => void }) =>
      R.createElement('div', { 'data-testid': 'tile-editor' },
        R.createElement('button', { onClick: onSave }, 'Save'),
        R.createElement('button', { onClick: onClose }, 'Cancel'),
      ),
  };
});

import AssetEditor from '../../src/AssetEditor';

const baseProps = {
  open: true,
  onClose: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AssetEditor', () => {
  test('renders nothing when open=false', () => {
    const { container } = render(<AssetEditor {...baseProps} open={false} mode="sheet" />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when mode=null', () => {
    const { container } = render(<AssetEditor {...baseProps} mode={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('mode=sheet renders SheetEditor', async () => {
    render(
      <Suspense fallback={null}>
        <AssetEditor {...baseProps} mode="sheet" />
      </Suspense>
    );
    await act(async () => {});
    expect(screen.getByTestId('sheet-editor')).toBeInTheDocument();
  });

  test('mode=tilemap renders TileEditor', async () => {
    render(
      <Suspense fallback={null}>
        <AssetEditor {...baseProps} mode="tilemap" tilemapInitial={{ name: 'level1' }} onSaveTilemap={jest.fn()} />
      </Suspense>
    );
    await act(async () => {});
    expect(screen.getByTestId('tile-editor')).toBeInTheDocument();
  });

  test('clicking outside backdrop calls onClose', () => {
    const onClose = jest.fn();
    const { container } = render(
      <Suspense fallback={null}>
        <AssetEditor open mode="tilemap" onClose={onClose} />
      </Suspense>
    );
    // The outermost div is the backdrop
    const backdrop = container.firstChild as HTMLElement;
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
