/**
 * Tests for EditableTitle component
 *
 * EditableTitle provides inline-editable title functionality:
 * - Shows InputBase when in edit mode
 * - Shows Typography when not in edit mode
 * - Supports different typography variants
 * - Accepts children to append after title text
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableTitle } from './EditableTitle';

describe('EditableTitle', () => {
  describe('display mode (editMode=false)', () => {
    it('renders as Typography when not in edit mode', () => {
      render(<EditableTitle value="Test Title" editMode={false} />);

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('renders children after the title text', () => {
      render(
        <EditableTitle value="Fleet Status" editMode={false}>
          : Running
        </EditableTitle>
      );

      expect(screen.getByText(/Fleet Status/)).toBeInTheDocument();
      expect(screen.getByText(/: Running/)).toBeInTheDocument();
    });

    it('uses h6 variant by default', () => {
      render(<EditableTitle value="Default Variant" editMode={false} />);

      const element = screen.getByText('Default Variant');
      expect(element.tagName).toBe('H6');
    });

    it('supports custom typography variant', () => {
      render(<EditableTitle value="Subtitle" variant="subtitle1" editMode={false} />);

      const element = screen.getByText('Subtitle');
      expect(element.tagName).toBe('H6'); // MUI subtitle1 renders as h6 by default
    });
  });

  describe('edit mode (editMode=true)', () => {
    it('renders as InputBase when in edit mode with onChange', () => {
      const onChange = vi.fn();
      render(<EditableTitle value="Editable" editMode={true} onChange={onChange} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Editable')).toBeInTheDocument();
    });

    it('calls onChange when value is edited', () => {
      const onChange = vi.fn();
      render(<EditableTitle value="Original" editMode={true} onChange={onChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Updated' } });

      expect(onChange).toHaveBeenCalledWith('Updated');
    });

    it('shows placeholder when value is empty', () => {
      const onChange = vi.fn();
      render(
        <EditableTitle
          value=""
          editMode={true}
          onChange={onChange}
          placeholder="Enter title..."
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', 'Enter title...');
    });

    it('renders as Typography if editMode is true but no onChange provided', () => {
      render(<EditableTitle value="No Handler" editMode={true} />);

      // Without onChange, it should render as Typography even in edit mode
      expect(screen.getByText('No Handler')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('default props', () => {
    it('defaults editMode to false', () => {
      render(<EditableTitle value="Default Mode" />);

      expect(screen.getByText('Default Mode')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('uses default placeholder when not specified', () => {
      const onChange = vi.fn();
      render(<EditableTitle value="" editMode={true} onChange={onChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', 'Enter title...');
    });
  });
});
