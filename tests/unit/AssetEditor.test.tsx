import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React, { Suspense } from 'react';

// Mock lazy-loaded editors so Suspense resolves synchronously in jsdom
jest.mock('../../src/PixelEditor', () => {
  const R = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: ({ initialName, onClose, onSave }: { initialName: string; onClose: () => void; onSave: () => void }) =>
      R.createElement('div', { 'data-testid': 'pixel-editor', 'data-name': initialName },
        R.createElement('button', { onClick: onSave }, 'Save'),
        R.createElement('button', { onClick: onClose }, 'Cancel'),
      ),
  };
});

jest.mock('../../src/TileEditor', () => {
  const R = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: ({ initialName, onClose, onSave }: { initialName: string; onClose: () => void; onSave: () => void }) =>
      R.createElement('div', { 'data-testid': 'tile-editor', 'data-name': initialName },
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
    const { container } = render(<AssetEditor {...baseProps} open={false} mode="sprite" />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when mode=null', () => {
    const { container } = render(<AssetEditor {...baseProps} mode={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('mode=new shows the type picker with three options', () => {
    render(<AssetEditor {...baseProps} mode="new" />);
    expect(screen.getByText('Pixel sprite')).toBeInTheDocument();
    expect(screen.getByText('Animation')).toBeInTheDocument();
    expect(screen.getByText('Tilemap')).toBeInTheDocument();
  });

  test('mode=new picker Cancel calls onClose', () => {
    const onClose = jest.fn();
    render(<AssetEditor {...baseProps} mode="new" onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  test('mode=new picking Pixel sprite transitions to PixelEditor', async () => {
    render(
      <Suspense fallback={null}>
        <AssetEditor {...baseProps} mode="new" spriteInitial={{ name: 'hero' }} onSaveSprite={jest.fn()} />
      </Suspense>
    );
    fireEvent.click(screen.getByText('Pixel sprite'));
    await act(async () => {});
    expect(screen.getByTestId('pixel-editor')).toBeInTheDocument();
  });

  test('mode=new picking Tilemap transitions to TileEditor', async () => {
    render(
      <Suspense fallback={null}>
        <AssetEditor {...baseProps} mode="new" tilemapInitial={{ name: 'map1' }} onSaveTilemap={jest.fn()} />
      </Suspense>
    );
    fireEvent.click(screen.getByText('Tilemap'));
    await act(async () => {});
    expect(screen.getByTestId('tile-editor')).toBeInTheDocument();
  });

  test('mode=sprite renders PixelEditor', async () => {
    render(
      <Suspense fallback={null}>
        <AssetEditor {...baseProps} mode="sprite" spriteInitial={{ name: 'hero' }} onSaveSprite={jest.fn()} />
      </Suspense>
    );
    await act(async () => {});
    expect(screen.getByTestId('pixel-editor')).toBeInTheDocument();
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

  test('mode=sprite-anim renders PixelEditor (animation mode)', async () => {
    render(
      <Suspense fallback={null}>
        <AssetEditor
          {...baseProps}
          mode="sprite-anim"
          animationInitial={{ name: 'walk' }}
          onSaveAnimation={jest.fn()}
        />
      </Suspense>
    );
    await act(async () => {});
    expect(screen.getByTestId('pixel-editor')).toBeInTheDocument();
  });

  test('re-opening with open=false resets picker', async () => {
    const { rerender } = render(
      <Suspense fallback={null}>
        <AssetEditor {...baseProps} mode="new" />
      </Suspense>
    );
    fireEvent.click(screen.getByText('Pixel sprite'));
    await act(async () => {});
    rerender(
      <Suspense fallback={null}>
        <AssetEditor {...baseProps} open={false} mode="new" />
      </Suspense>
    );
    rerender(
      <Suspense fallback={null}>
        <AssetEditor {...baseProps} open={true} mode="new" />
      </Suspense>
    );
    expect(screen.getByText('Pixel sprite')).toBeInTheDocument();
  });
});
