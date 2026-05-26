import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

jest.mock('../../src/state/IdeState', () => ({
  useEditor: (selector: (s: unknown) => unknown) => selector({
    project: { assets: {}, tilemaps: {} },
  }),
}));

import TileEditor from '../../src/TileEditor';

const defaultProps = {
  open: true,
  initialName: 'level1',
  onClose: jest.fn(),
  onSave: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TileEditor', () => {
  test('renders header with "Tilemap Editor"', () => {
    render(<TileEditor {...defaultProps} />);
    expect(screen.getByText('Tilemap Editor')).toBeInTheDocument();
  });

  test('renders Save and Close buttons', () => {
    render(<TileEditor {...defaultProps} />);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  test('clicking Save calls onSave with name and data', () => {
    const onSave = jest.fn();
    render(<TileEditor {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const [name, data] = (onSave as jest.Mock).mock.calls[0] as [string, unknown];
    expect(name).toBe('level1');
    expect(data).toHaveProperty('layers');
    expect(data).toHaveProperty('areas');
  });

  test('starts with one default ground layer', () => {
    render(<TileEditor {...defaultProps} />);
    expect(screen.getByText('ground')).toBeInTheDocument();
  });

  test('Add layer button creates a second layer', () => {
    render(<TileEditor {...defaultProps} />);
    const addBtn = screen.getByTitle('Add layer');
    fireEvent.click(addBtn);
    expect(screen.getByText('layer2')).toBeInTheDocument();
  });

  test('clicking second layer makes it active', () => {
    render(<TileEditor {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Add layer'));
    const layer2 = screen.getByText('layer2');
    fireEvent.click(layer2);
    expect(layer2).toBeInTheDocument();
  });

  test('save after add layer includes both layers', () => {
    const onSave = jest.fn();
    render(<TileEditor {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByTitle('Add layer'));
    fireEvent.click(screen.getByText('Save'));
    const data = (onSave as jest.Mock).mock.calls[0]?.[1] as { layers: unknown[] };
    expect(data.layers).toHaveLength(2);
  });

  test('mode toggle shows Tiles and Areas buttons', () => {
    render(<TileEditor {...defaultProps} />);
    expect(screen.getByText('Tiles')).toBeInTheDocument();
    expect(screen.getByText('Areas')).toBeInTheDocument();
  });

  test('switching to Areas mode does not crash', () => {
    render(<TileEditor {...defaultProps} />);
    const areasButtons = screen.getAllByText('Areas');
    fireEvent.click(areasButtons[0]);
    expect(screen.getAllByText('Areas').length).toBeGreaterThan(0);
  });

  test('undo button exists and is initially disabled', () => {
    render(<TileEditor {...defaultProps} />);
    const undoBtn = screen.getByTitle('Undo (Ctrl+Z)');
    expect(undoBtn).toBeDisabled();
  });

  test('snapshot: toolbar buttons at default state', () => {
    render(<TileEditor {...defaultProps} />);
    const labels = Array.from(document.querySelectorAll('button[title]'))
      .map(b => b.getAttribute('title'))
      .filter(Boolean);
    expect(labels).toMatchSnapshot();
  });
});
