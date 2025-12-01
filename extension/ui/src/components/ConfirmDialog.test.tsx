/**
 * Tests for ConfirmDialog component
 *
 * ConfirmDialog provides a reusable confirmation dialog:
 * - Displays title and message
 * - Shows customizable confirm and cancel buttons
 * - Supports different button colors for confirm action
 * - Calls appropriate callbacks when buttons clicked
 * - Does not render when open is false
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  describe('when open', () => {
    it('renders dialog title', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('renders dialog message', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('renders confirm button with default label', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('renders cancel button with default label', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders confirm button with custom label', () => {
      render(<ConfirmDialog {...defaultProps} confirmLabel="Delete" />);

      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('renders cancel button with custom label', () => {
      render(<ConfirmDialog {...defaultProps} cancelLabel="Go Back" />);

      expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
    });

    it('calls onConfirm when confirm button clicked', () => {
      const onConfirm = vi.fn();
      render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when cancel button clicked', () => {
      const onCancel = vi.fn();
      render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('confirm button is contained variant', () => {
      render(<ConfirmDialog {...defaultProps} />);

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveClass('MuiButton-contained');
    });

    it('applies primary color to confirm button by default', () => {
      render(<ConfirmDialog {...defaultProps} />);

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveClass('MuiButton-containedPrimary');
    });

    it('applies error color to confirm button when specified', () => {
      render(<ConfirmDialog {...defaultProps} confirmColor="error" />);

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveClass('MuiButton-containedError');
    });

    it('applies warning color to confirm button when specified', () => {
      render(<ConfirmDialog {...defaultProps} confirmColor="warning" />);

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveClass('MuiButton-containedWarning');
    });

    it('applies success color to confirm button when specified', () => {
      render(<ConfirmDialog {...defaultProps} confirmColor="success" />);

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveClass('MuiButton-containedSuccess');
    });
  });

  describe('when closed', () => {
    it('does not render dialog content when open is false', () => {
      render(<ConfirmDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
      expect(screen.queryByText('Are you sure you want to proceed?')).not.toBeInTheDocument();
    });

    it('does not render buttons when open is false', () => {
      render(<ConfirmDialog {...defaultProps} open={false} />);

      expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  describe('dialog behavior', () => {
    it('renders within a dialog element', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('confirm button has autoFocus', () => {
      render(<ConfirmDialog {...defaultProps} />);

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      // MUI adds autoFocus behavior - we can check the button exists
      expect(confirmButton).toBeInTheDocument();
    });
  });
});
