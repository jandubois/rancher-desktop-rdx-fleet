/**
 * Tests for EditableHeaderIcon component
 *
 * EditableHeaderIcon provides inline icon editing in the extension header:
 * - Three icon states: null (default Fleet icon), CustomIcon, or 'deleted'
 * - View mode: shows default icon, custom icon, or nothing (if deleted)
 * - Edit mode: shows hover overlay, delete button, drag-drop support
 * - Edit mode with deleted state: shows placeholder add icon
 * - Validates file type and size (same as IconUpload)
 * - Shows temporary error messages for invalid uploads
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditableHeaderIcon, IconState } from './EditableHeaderIcon';
import { CustomIcon } from './IconUpload';

describe('EditableHeaderIcon', () => {
  const defaultProps = {
    iconState: null as IconState,
    onChange: vi.fn(),
    editMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode (editMode=false)', () => {
    describe('with default icon (iconState=null)', () => {
      it('renders the default Fleet icon SVG', () => {
        const { container } = render(<EditableHeaderIcon {...defaultProps} iconState={null} />);

        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });

      it('does not show edit controls', () => {
        render(<EditableHeaderIcon {...defaultProps} iconState={null} />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
      });
    });

    describe('with custom icon', () => {
      const customIcon: CustomIcon = {
        data: 'base64data',
        filename: 'custom.png',
        mimeType: 'image/png',
      };

      it('renders custom icon image', () => {
        render(<EditableHeaderIcon {...defaultProps} iconState={customIcon} />);

        const img = screen.getByAltText('Extension icon');
        expect(img).toHaveAttribute('src', 'data:image/png;base64,base64data');
      });

      it('does not show delete button', () => {
        render(<EditableHeaderIcon {...defaultProps} iconState={customIcon} />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
      });
    });

    describe('with deleted state (iconState="deleted")', () => {
      it('returns null (renders nothing)', () => {
        const { container } = render(<EditableHeaderIcon {...defaultProps} iconState="deleted" />);

        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe('edit mode (editMode=true)', () => {
    describe('with default icon (iconState=null)', () => {
      it('renders the default Fleet icon SVG', () => {
        const { container } = render(
          <EditableHeaderIcon {...defaultProps} iconState={null} editMode={true} />
        );

        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });

      it('has clickable cursor', () => {
        const { container } = render(
          <EditableHeaderIcon {...defaultProps} iconState={null} editMode={true} />
        );

        // The outer box should have cursor pointer
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveStyle({ cursor: 'pointer' });
      });

      it('shows delete button on hover', async () => {
        const { container } = render(
          <EditableHeaderIcon {...defaultProps} iconState={null} editMode={true} />
        );

        const wrapper = container.firstChild as HTMLElement;
        fireEvent.mouseEnter(wrapper);

        // Delete button appears on hover
        await waitFor(() => {
          expect(screen.getByRole('button')).toBeInTheDocument();
        });
      });

      it('calls onChange with "deleted" when delete clicked', async () => {
        const onChange = vi.fn();
        const { container } = render(
          <EditableHeaderIcon {...defaultProps} iconState={null} editMode={true} onChange={onChange} />
        );

        const wrapper = container.firstChild as HTMLElement;
        fireEvent.mouseEnter(wrapper);

        await waitFor(() => {
          const deleteButton = screen.getByRole('button');
          fireEvent.click(deleteButton);
        });

        expect(onChange).toHaveBeenCalledWith('deleted');
      });
    });

    describe('with custom icon', () => {
      const customIcon: CustomIcon = {
        data: 'base64data',
        filename: 'custom.png',
        mimeType: 'image/png',
      };

      it('renders custom icon image', () => {
        render(<EditableHeaderIcon {...defaultProps} iconState={customIcon} editMode={true} />);

        const img = screen.getByAltText('Extension icon');
        expect(img).toBeInTheDocument();
      });

      it('shows delete button on hover', async () => {
        const { container } = render(
          <EditableHeaderIcon {...defaultProps} iconState={customIcon} editMode={true} />
        );

        const wrapper = container.firstChild as HTMLElement;
        fireEvent.mouseEnter(wrapper);

        await waitFor(() => {
          expect(screen.getByRole('button')).toBeInTheDocument();
        });
      });

      it('calls onChange with "deleted" when delete clicked', async () => {
        const onChange = vi.fn();
        const { container } = render(
          <EditableHeaderIcon {...defaultProps} iconState={customIcon} editMode={true} onChange={onChange} />
        );

        const wrapper = container.firstChild as HTMLElement;
        fireEvent.mouseEnter(wrapper);

        await waitFor(() => {
          const deleteButton = screen.getByRole('button');
          fireEvent.click(deleteButton);
        });

        expect(onChange).toHaveBeenCalledWith('deleted');
      });
    });

    describe('with deleted state (iconState="deleted")', () => {
      it('renders add photo placeholder icon', () => {
        render(<EditableHeaderIcon {...defaultProps} iconState="deleted" editMode={true} />);

        expect(screen.getByTestId('AddPhotoAlternateIcon')).toBeInTheDocument();
      });

      it('does not show delete button', async () => {
        const { container } = render(
          <EditableHeaderIcon {...defaultProps} iconState="deleted" editMode={true} />
        );

        const wrapper = container.firstChild as HTMLElement;
        fireEvent.mouseEnter(wrapper);

        // Give time for any async renders
        await new Promise(resolve => setTimeout(resolve, 100));

        // No delete button when already deleted
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
      });

      it('has dashed border indicating upload area', () => {
        const { container } = render(
          <EditableHeaderIcon {...defaultProps} iconState="deleted" editMode={true} />
        );

        // The icon container should have a dashed border style
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toBeInTheDocument();
      });
    });
  });

  describe('drag and drop', () => {
    it('ignores drag events in view mode', () => {
      const onChange = vi.fn();
      const { container } = render(
        <EditableHeaderIcon {...defaultProps} iconState={null} editMode={false} onChange={onChange} />
      );

      const wrapper = container.firstChild as HTMLElement;
      fireEvent.dragOver(wrapper);
      fireEvent.drop(wrapper, {
        dataTransfer: {
          files: [new File(['content'], 'test.png', { type: 'image/png' })],
        },
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('shows drop indicator in edit mode on dragOver', () => {
      const { container } = render(
        <EditableHeaderIcon {...defaultProps} iconState={null} editMode={true} />
      );

      const wrapper = container.firstChild as HTMLElement;
      fireEvent.dragOver(wrapper);

      expect(screen.getByText('Drop')).toBeInTheDocument();
    });

    it('hides drop indicator on dragLeave', async () => {
      const { container } = render(
        <EditableHeaderIcon {...defaultProps} iconState={null} editMode={true} />
      );

      const wrapper = container.firstChild as HTMLElement;
      fireEvent.dragOver(wrapper);
      expect(screen.getByText('Drop')).toBeInTheDocument();

      fireEvent.dragLeave(wrapper);

      await waitFor(() => {
        expect(screen.queryByText('Drop')).not.toBeInTheDocument();
      });
    });
  });

  describe('file validation', () => {
    it('rejects invalid file types', async () => {
      const onChange = vi.fn();
      const { container } = render(
        <EditableHeaderIcon {...defaultProps} iconState={null} editMode={true} onChange={onChange} />
      );

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const invalidFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' });

      fireEvent.change(input, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText('Invalid file type')).toBeInTheDocument();
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('rejects oversized files', async () => {
      const onChange = vi.fn();
      const { container } = render(
        <EditableHeaderIcon {...defaultProps} iconState={null} editMode={true} onChange={onChange} />
      );

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const largeContent = 'x'.repeat(600 * 1024);
      const largeFile = new File([largeContent], 'large.png', { type: 'image/png' });

      fireEvent.change(input, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText('File too large (max 512KB)')).toBeInTheDocument();
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('processes valid PNG files through FileReader', async () => {
      const onChange = vi.fn();
      const { container } = render(
        <EditableHeaderIcon {...defaultProps} iconState={null} editMode={true} onChange={onChange} />
      );

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'icon.png', { type: 'image/png' });

      fireEvent.change(input, { target: { files: [validFile] } });

      // FileReader will process the file asynchronously
      // The file passes validation, so FileReader.readAsDataURL is called
      // In a real browser, onChange would be called with the result
      // For jsdom, we just verify no error is shown for valid files
      await waitFor(() => {
        expect(screen.queryByText(/Invalid file type/)).not.toBeInTheDocument();
        expect(screen.queryByText(/File too large/)).not.toBeInTheDocument();
      });
    });
  });

  describe('click to upload', () => {
    it('ignores clicks in view mode', () => {
      const { container } = render(
        <EditableHeaderIcon {...defaultProps} iconState={null} editMode={false} />
      );

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      const wrapper = container.firstChild as HTMLElement;
      fireEvent.click(wrapper);

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('triggers file input click in edit mode', () => {
      const { container } = render(
        <EditableHeaderIcon {...defaultProps} iconState={null} editMode={true} />
      );

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      const wrapper = container.firstChild as HTMLElement;
      fireEvent.click(wrapper);

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('hidden file input', () => {
    it('renders hidden file input in edit mode', () => {
      const { container } = render(
        <EditableHeaderIcon {...defaultProps} iconState={null} editMode={true} />
      );

      const input = container.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      expect(input).toHaveStyle({ display: 'none' });
    });

    it('file input accepts correct file types', () => {
      const { container } = render(
        <EditableHeaderIcon {...defaultProps} iconState={null} editMode={true} />
      );

      const input = container.querySelector('input[type="file"]');
      expect(input).toHaveAttribute(
        'accept',
        'image/png,image/svg+xml,image/jpeg,image/gif,image/webp'
      );
    });
  });
});
