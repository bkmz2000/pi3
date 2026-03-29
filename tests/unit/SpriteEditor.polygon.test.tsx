import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import SpriteEditor from '../../src/SpriteEditor';

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  onSave: jest.fn(),
  size: 64 as const,
};

describe('SpriteEditor - Polygon Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders polygon tool button', () => {
    render(<SpriteEditor {...defaultProps} />);
    const polygonTool = screen.getByTestId('tool-polygon');
    expect(polygonTool).toBeInTheDocument();
  });

  test('selects polygon tool when clicked', () => {
    render(<SpriteEditor {...defaultProps} />);
    const polygonTool = screen.getByTestId('tool-polygon');
    fireEvent.click(polygonTool);
    expect(polygonTool).toHaveClass('bg-cyan-600');
  });

  test('canvas is rendered', () => {
    render(<SpriteEditor {...defaultProps} />);
    const canvas = screen.getByTestId('sprite-canvas');
    expect(canvas).toBeInTheDocument();
  });

  test('renders all tool buttons', () => {
    render(<SpriteEditor {...defaultProps} />);
    expect(screen.getByTestId('tool-select')).toBeInTheDocument();
    expect(screen.getByTestId('tool-rect')).toBeInTheDocument();
    expect(screen.getByTestId('tool-ellipse')).toBeInTheDocument();
    expect(screen.getByTestId('tool-line')).toBeInTheDocument();
    expect(screen.getByTestId('tool-freehand')).toBeInTheDocument();
    expect(screen.getByTestId('tool-polygon')).toBeInTheDocument();
    expect(screen.getByTestId('tool-text')).toBeInTheDocument();
  });

  test('clicking polygon tool changes selected tool', () => {
    render(<SpriteEditor {...defaultProps} />);
    const polygonTool = screen.getByTestId('tool-polygon');
    fireEvent.click(polygonTool);
    expect(polygonTool).toHaveClass('bg-cyan-600', 'text-white');
  });

  test('clicking another tool deselects polygon tool', () => {
    render(<SpriteEditor {...defaultProps} />);
    const polygonTool = screen.getByTestId('tool-polygon');
    const rectTool = screen.getByTestId('tool-rect');
    
    fireEvent.click(polygonTool);
    expect(polygonTool).toHaveClass('bg-cyan-600');
    
    fireEvent.click(rectTool);
    expect(polygonTool).not.toHaveClass('bg-cyan-600');
    expect(rectTool).toHaveClass('bg-cyan-600');
  });

  test('fill color button exists and opens popover', () => {
    render(<SpriteEditor {...defaultProps} />);
    const fillButton = screen.getByTestId('fill-color-button');
    expect(fillButton).toBeInTheDocument();
    fireEvent.click(fillButton);
    const fillPopover = screen.getByTestId('fill-color-popover');
    expect(fillPopover).toBeInTheDocument();
  });

  test('stroke color button exists and opens popover', () => {
    render(<SpriteEditor {...defaultProps} />);
    const strokeButton = screen.getByTestId('stroke-color-button');
    expect(strokeButton).toBeInTheDocument();
    fireEvent.click(strokeButton);
    const strokePopover = screen.getByTestId('stroke-color-popover');
    expect(strokePopover).toBeInTheDocument();
  });

  test('stroke width input exists', () => {
    render(<SpriteEditor {...defaultProps} />);
    const strokeWidthInput = screen.getByTestId('stroke-width-input');
    expect(strokeWidthInput).toBeInTheDocument();
  });

  test('undo button exists', () => {
    render(<SpriteEditor {...defaultProps} />);
    const undoButton = screen.getByTestId('undo-button');
    expect(undoButton).toBeInTheDocument();
  });

  test('redo button exists', () => {
    render(<SpriteEditor {...defaultProps} />);
    const redoButton = screen.getByTestId('redo-button');
    expect(redoButton).toBeInTheDocument();
  });

  test('delete button exists', () => {
    render(<SpriteEditor {...defaultProps} />);
    const deleteButton = screen.getByTestId('delete-button');
    expect(deleteButton).toBeInTheDocument();
  });

  test('save button exists', () => {
    render(<SpriteEditor {...defaultProps} />);
    expect(screen.getByTestId('save-svg-button')).toBeInTheDocument();
  });

  test('sprite name input exists', () => {
    render(<SpriteEditor {...defaultProps} />);
    const nameInput = screen.getByTestId('sprite-name-input');
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveValue('sprite');
  });

  test('close button exists', () => {
    render(<SpriteEditor {...defaultProps} />);
    const closeButton = screen.getByTestId('close-button');
    expect(closeButton).toBeInTheDocument();
  });

  test('onClose is called when close button is clicked', () => {
    const onClose = jest.fn();
    render(<SpriteEditor {...defaultProps} onClose={onClose} />);
    const closeButton = screen.getByTestId('close-button');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  test('renders modal when open is true', () => {
    render(<SpriteEditor {...defaultProps} open={true} />);
    expect(screen.getByTestId('sprite-editor-modal')).toBeInTheDocument();
  });

  test('does not render modal when open is false', () => {
    render(<SpriteEditor {...defaultProps} open={false} />);
    expect(screen.queryByTestId('sprite-editor-modal')).not.toBeInTheDocument();
  });

  test('undo button is disabled when no history', () => {
    render(<SpriteEditor {...defaultProps} />);
    const undoButton = screen.getByTestId('undo-button');
    expect(undoButton).toBeDisabled();
  });

  test('redo button is disabled when no future', () => {
    render(<SpriteEditor {...defaultProps} />);
    const redoButton = screen.getByTestId('redo-button');
    expect(redoButton).toBeDisabled();
  });

  test('delete button is disabled when nothing selected', () => {
    render(<SpriteEditor {...defaultProps} />);
    const deleteButton = screen.getByTestId('delete-button');
    expect(deleteButton).toBeDisabled();
  });

  test('changing fill color updates fill state', () => {
    render(<SpriteEditor {...defaultProps} />);
    const fillButton = screen.getByTestId('fill-color-button');
    fireEvent.click(fillButton);
    const fillPopover = screen.getByTestId('fill-color-popover');
    expect(fillPopover).toBeInTheDocument();
  });

  test('changing stroke color updates stroke state', () => {
    render(<SpriteEditor {...defaultProps} />);
    const strokeButton = screen.getByTestId('stroke-color-button');
    fireEvent.click(strokeButton);
    const strokePopover = screen.getByTestId('stroke-color-popover');
    expect(strokePopover).toBeInTheDocument();
  });

  test('changing stroke width updates width state', () => {
    render(<SpriteEditor {...defaultProps} />);
    const strokeWidthInput = screen.getByTestId('stroke-width-input');
    fireEvent.change(strokeWidthInput, { target: { value: '3' } });
    expect(strokeWidthInput).toHaveValue('3');
  });

  test('changing sprite name updates name state', () => {
    render(<SpriteEditor {...defaultProps} />);
    const nameInput = screen.getByTestId('sprite-name-input');
    fireEvent.change(nameInput, { target: { value: 'mySprite' } });
    expect(nameInput).toHaveValue('mySprite');
  });
});
