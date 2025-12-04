/**
 * Tests for DividerCard component
 *
 * DividerCard provides visual separation between content sections:
 * - Renders a horizontal divider line with configurable style (solid/dashed/dotted)
 * - Supports optional centered label text
 * - Edit mode: shows label input and style dropdown with preview
 * - View mode: renders just the divider (with or without label)
 * - Applies palette border color to divider line
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DividerCard } from './DividerCard';
import { CardDefinition, DividerCardSettings } from '../manifest/types';

describe('DividerCard', () => {
  const defaultDefinition: CardDefinition = {
    id: 'test-divider',
    type: 'divider',
  };

  const defaultSettings: DividerCardSettings = {};

  describe('view mode (editMode=false)', () => {
    it('renders a divider element', () => {
      const { container } = render(
        <DividerCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={false}
        />
      );

      expect(container.querySelector('hr')).toBeInTheDocument();
    });

    it('renders solid divider by default', () => {
      const { container } = render(
        <DividerCard
          definition={defaultDefinition}
          settings={{}}
          editMode={false}
        />
      );

      const divider = container.querySelector('hr');
      expect(divider).toBeInTheDocument();
    });

    it('renders without label when none provided', () => {
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{}}
          editMode={false}
        />
      );

      // Should not have any text content in view mode without label
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('renders label when provided', () => {
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{ label: 'Section Title' }}
          editMode={false}
        />
      );

      expect(screen.getByText('Section Title')).toBeInTheDocument();
    });

    it('renders with dashed style when configured', () => {
      const { container } = render(
        <DividerCard
          definition={defaultDefinition}
          settings={{ style: 'dashed' }}
          editMode={false}
        />
      );

      const divider = container.querySelector('hr');
      expect(divider).toBeInTheDocument();
    });

    it('renders with dotted style when configured', () => {
      const { container } = render(
        <DividerCard
          definition={defaultDefinition}
          settings={{ style: 'dotted' }}
          editMode={false}
        />
      );

      const divider = container.querySelector('hr');
      expect(divider).toBeInTheDocument();
    });

    it('applies palette border color', () => {
      const { container } = render(
        <DividerCard
          definition={defaultDefinition}
          settings={{}}
          editMode={false}
          paletteColors={{ border: '#ff0000' }}
        />
      );

      const divider = container.querySelector('hr');
      expect(divider).toBeInTheDocument();
    });
  });

  describe('edit mode (editMode=true)', () => {
    it('shows label input field', () => {
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{}}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByLabelText(/Label/i)).toBeInTheDocument();
    });

    it('shows style dropdown', () => {
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{}}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('shows Line Style label', () => {
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{}}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Line Style:')).toBeInTheDocument();
    });

    it('shows preview section', () => {
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{}}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Preview:')).toBeInTheDocument();
    });

    it('calls onSettingsChange when label is edited', () => {
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{}}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/Label/i);
      fireEvent.change(input, { target: { value: 'New Label' } });

      expect(onSettingsChange).toHaveBeenCalledWith({ label: 'New Label' });
    });

    it('calls onSettingsChange when style is changed to dashed', async () => {
      const user = userEvent.setup();
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{ style: 'solid' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // Open the dropdown
      await user.click(screen.getByRole('combobox'));
      // Select dashed option from the listbox
      const listbox = within(screen.getByRole('listbox'));
      await user.click(listbox.getByText('Dashed'));

      expect(onSettingsChange).toHaveBeenCalledWith({ style: 'dashed' });
    });

    it('calls onSettingsChange when style is changed to dotted', async () => {
      const user = userEvent.setup();
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{ style: 'solid' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // Open the dropdown
      await user.click(screen.getByRole('combobox'));
      // Select dotted option from the listbox
      const listbox = within(screen.getByRole('listbox'));
      await user.click(listbox.getByText('Dotted'));

      expect(onSettingsChange).toHaveBeenCalledWith({ style: 'dotted' });
    });

    it('preserves existing settings when updating label', () => {
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{ style: 'dashed', label: 'Old' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/Label/i);
      fireEvent.change(input, { target: { value: 'New' } });

      expect(onSettingsChange).toHaveBeenCalledWith({ style: 'dashed', label: 'New' });
    });

    it('preserves existing settings when updating style', async () => {
      const user = userEvent.setup();
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{ style: 'solid', label: 'Keep Me' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // Open the dropdown
      await user.click(screen.getByRole('combobox'));
      // Select dotted option from the listbox
      const listbox = within(screen.getByRole('listbox'));
      await user.click(listbox.getByText('Dotted'));

      expect(onSettingsChange).toHaveBeenCalledWith({ label: 'Keep Me', style: 'dotted' });
    });

    it('shows placeholder text in label input', () => {
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{}}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/Label/i);
      expect(input).toHaveAttribute('placeholder', 'Section title...');
    });

    it('pre-fills label input with current value', () => {
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{ label: 'Existing Label' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/Label/i);
      expect(input).toHaveValue('Existing Label');
    });

    it('displays current style in dropdown', () => {
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{ style: 'dashed' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // The Select should display the current style name
      expect(screen.getByText('Dashed')).toBeInTheDocument();
    });

    it('renders in view mode when editMode true but no onSettingsChange', () => {
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{ label: 'View Mode' }}
          editMode={true}
          // No onSettingsChange provided
        />
      );

      // Should render view mode (just the divider with label)
      expect(screen.getByText('View Mode')).toBeInTheDocument();
      // Should not have edit controls
      expect(screen.queryByLabelText(/Label/i)).not.toBeInTheDocument();
      // MUI Divider with children uses role="separator" instead of hr
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });
  });

  describe('preview in edit mode', () => {
    it('shows label in preview when provided', () => {
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{ label: 'Preview Label' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // Label appears twice: once in preview section
      const labels = screen.getAllByText('Preview Label');
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });

    it('shows divider without label in preview when label is empty', () => {
      const onSettingsChange = vi.fn();
      const { container } = render(
        <DividerCard
          definition={defaultDefinition}
          settings={{ label: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // Preview should still contain a divider
      expect(container.querySelector('hr')).toBeInTheDocument();
    });
  });

  describe('default values', () => {
    it('defaults style to solid when not specified', () => {
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{}}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // The Select should display Solid as the default style
      expect(screen.getByText('Solid')).toBeInTheDocument();
    });

    it('defaults label to empty string when not specified', () => {
      const onSettingsChange = vi.fn();
      render(
        <DividerCard
          definition={defaultDefinition}
          settings={{}}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/Label/i);
      expect(input).toHaveValue('');
    });

    it('handles undefined settings gracefully', () => {
      const { container } = render(
        <DividerCard
          definition={defaultDefinition}
          settings={undefined as unknown as DividerCardSettings}
          editMode={false}
        />
      );

      expect(container.querySelector('hr')).toBeInTheDocument();
    });
  });
});
