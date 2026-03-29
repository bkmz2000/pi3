import { describe, test, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SpriteEditor from '../../src/SpriteEditor';

const defaultProps = {
  open: true,
  onClose: () => {},
  onSave: () => {},
  size: 64 as const,
};

describe('SpriteEditor - Snapshot Tests', () => {
  test('renders correctly when open', () => {
    const { container } = render(<SpriteEditor {...defaultProps} />);
    expect(container).toMatchSnapshot();
  });

  test('renders correctly when closed', () => {
    const { container } = render(<SpriteEditor {...defaultProps} open={false} />);
    expect(container).toMatchSnapshot();
  });

  test('renders with default props', () => {
    const { asFragment } = render(<SpriteEditor {...defaultProps} />);
    expect(asFragment()).toMatchSnapshot();
  });

  test('renders with custom size 128', () => {
    const { asFragment } = render(<SpriteEditor {...defaultProps} size={128} />);
    expect(asFragment()).toMatchSnapshot();
  });

  test('renders with initial name', () => {
    const { asFragment } = render(<SpriteEditor {...defaultProps} initialName="mySprite" />);
    expect(asFragment()).toMatchSnapshot();
  });

  test('renders tool buttons correctly', () => {
    render(<SpriteEditor {...defaultProps} />);
    expect(screen.getByTestId('tool-select')).toBeInTheDocument();
    expect(screen.getByTestId('tool-rect')).toBeInTheDocument();
    expect(screen.getByTestId('tool-ellipse')).toBeInTheDocument();
    expect(screen.getByTestId('tool-line')).toBeInTheDocument();
    expect(screen.getByTestId('tool-freehand')).toBeInTheDocument();
    expect(screen.getByTestId('tool-polygon')).toBeInTheDocument();
    expect(screen.getByTestId('tool-text')).toBeInTheDocument();
  });

  test('renders canvas element', () => {
    render(<SpriteEditor {...defaultProps} />);
    expect(screen.getByTestId('sprite-canvas')).toBeInTheDocument();
  });

  test('renders all control buttons', () => {
    render(<SpriteEditor {...defaultProps} />);
    expect(screen.getByTestId('undo-button')).toBeInTheDocument();
    expect(screen.getByTestId('redo-button')).toBeInTheDocument();
    expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    expect(screen.getByTestId('save-svg-button')).toBeInTheDocument();
  });

  test('renders color buttons', () => {
    render(<SpriteEditor {...defaultProps} />);
    expect(screen.getByTestId('stroke-width-input')).toBeInTheDocument();
  });

  test('renders sprite name input', () => {
    render(<SpriteEditor {...defaultProps} />);
    const nameInput = screen.getByTestId('sprite-name-input');
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveValue('sprite');
  });

  test('renders close button', () => {
    render(<SpriteEditor {...defaultProps} />);
    expect(screen.getByTestId('close-button')).toBeInTheDocument();
  });

  test('renders modal container', () => {
    render(<SpriteEditor {...defaultProps} />);
    expect(screen.getByTestId('sprite-editor-modal')).toBeInTheDocument();
  });

  test('renders editor content container', () => {
    render(<SpriteEditor {...defaultProps} />);
    expect(screen.getByTestId('sprite-editor-content')).toBeInTheDocument();
  });
});
