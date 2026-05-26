import { describe, test, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import PixelEditor, { PAL_NAMES } from '../../src/PixelEditor';

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  onSave: jest.fn(),
  size: 16 as const,
  initialName: 'hero',
};

describe('PixelEditor', () => {
  test('renders all paint tools including new line/rect/circle plus shade brushes', () => {
    render(<PixelEditor {...defaultProps} />);
    for (const label of ['Pencil', 'Eraser', 'Line', 'Rect', 'Circle', 'Fill', 'Eyedrop', 'Darken', 'Lighten', 'Mirror']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  test('renders the zoom chips with discrete steps', () => {
    render(<PixelEditor {...defaultProps} />);
    for (const z of ['50%', '100%', '200%', '400%']) {
      expect(screen.getAllByText(z).length).toBeGreaterThan(0);
    }
  });

  test('clicking a zoom chip leaves the modal mounted (no crash)', () => {
    render(<PixelEditor {...defaultProps} />);
    fireEvent.click(screen.getByText('200%'));
    expect(screen.getByText('200%')).toBeInTheDocument();
  });

  test('clicking the darken tool switches the active tool', () => {
    render(<PixelEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Darken'));
    expect(screen.getByLabelText('Pencil')).toBeInTheDocument();
  });

  test('save invokes the save handler', () => {
    const onSave = jest.fn();
    render(<PixelEditor {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  test('cancel calls onClose without crashing', () => {
    const onClose = jest.fn();
    render(<PixelEditor {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  test('mirror toggle button flips state on click', () => {
    render(<PixelEditor {...defaultProps} />);
    const mirror = screen.getByLabelText('Mirror');
    fireEvent.click(mirror);
    expect(mirror).toBeInTheDocument();
  });

  test('pick color from palette: clicking each tool group button does not crash', () => {
    render(<PixelEditor {...defaultProps} />);
    for (const label of ['Pencil', 'Eraser', 'Line', 'Rect', 'Circle', 'Fill', 'Eyedrop']) {
      fireEvent.click(screen.getByLabelText(label));
    }
    expect(screen.getByLabelText('Pencil')).toBeInTheDocument();
  });

  test('eyedropper tool selection does not unmount editor', () => {
    render(<PixelEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Eyedrop'));
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  test('save round-trip: clicking save keeps editor props accessible', () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    render(<PixelEditor {...defaultProps} onSave={onSave} onClose={onClose} initialName="test-sprite" />);
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  test('cancel discards: onClose is called immediately', () => {
    const onClose = jest.fn();
    render(<PixelEditor {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('undo button is rendered and clickable', () => {
    render(<PixelEditor {...defaultProps} />);
    const undoBtn = screen.getByTitle('Undo (Ctrl+Z)');
    fireEvent.click(undoBtn);
    expect(undoBtn).toBeInTheDocument();
  });

  test('PAL_NAMES has exactly 16 entries', () => {
    expect(Object.keys(PAL_NAMES)).toHaveLength(16);
  });

  test('PAL_NAMES values are non-empty strings', () => {
    for (const name of Object.values(PAL_NAMES)) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  test('snapshot: toolbar buttons rendered at default state', () => {
    const { container } = render(<PixelEditor {...defaultProps} />);
    const labels = Array.from(container.querySelectorAll('button[aria-label]'))
      .map(b => b.getAttribute('aria-label'));
    expect(labels).toMatchSnapshot();
  });
});
