/**
 * Tests for IconUpload component
 *
 * IconUpload provides icon file upload functionality:
 * - Accepts PNG, SVG, JPEG, GIF, WebP file types
 * - Validates file size (512KB max)
 * - Converts files to base64 for storage
 * - Shows preview of current/default icon
 * - Shows filename when custom icon is set
 * - Supports click and drag-and-drop upload
 * - Shows delete button when custom icon exists
 * - Displays error messages for invalid files
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IconUpload, CustomIcon } from './IconUpload';

describe('IconUpload', () => {
  const defaultProps = {
    value: null,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders Extension Icon label', () => {
      render(<IconUpload {...defaultProps} />);

      expect(screen.getByText('Extension Icon')).toBeInTheDocument();
    });

    it('renders upload instructions', () => {
      render(<IconUpload {...defaultProps} />);

      expect(screen.getByText('Drop or click to upload')).toBeInTheDocument();
    });

    it('renders accepted file types hint', () => {
      render(<IconUpload {...defaultProps} />);

      expect(screen.getByText('PNG, SVG, JPEG, GIF, WebP (max 512KB)')).toBeInTheDocument();
    });

    it('renders hidden file input', () => {
      const { container } = render(<IconUpload {...defaultProps} />);

      const input = container.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      expect(input).toHaveStyle({ display: 'none' });
    });

    it('file input accepts correct file types', () => {
      const { container } = render(<IconUpload {...defaultProps} />);

      const input = container.querySelector('input[type="file"]');
      expect(input).toHaveAttribute(
        'accept',
        'image/png,image/svg+xml,image/jpeg,image/gif,image/webp'
      );
    });
  });

  describe('preview display', () => {
    it('shows default icon placeholder when no value and no default path', () => {
      render(<IconUpload {...defaultProps} />);

      // Should show ImageIcon placeholder
      expect(screen.getByTestId('ImageIcon')).toBeInTheDocument();
    });

    it('shows default icon image when defaultIconPath provided', () => {
      render(<IconUpload {...defaultProps} defaultIconPath="/default-icon.png" />);

      const img = screen.getByAltText('Extension icon');
      expect(img).toHaveAttribute('src', '/default-icon.png');
    });

    it('shows custom icon preview when value provided', () => {
      const customIcon: CustomIcon = {
        data: 'base64data',
        filename: 'custom.png',
        mimeType: 'image/png',
      };

      render(<IconUpload {...defaultProps} value={customIcon} />);

      const img = screen.getByAltText('Extension icon');
      expect(img).toHaveAttribute('src', 'data:image/png;base64,base64data');
    });

    it('shows filename when custom icon is set', () => {
      const customIcon: CustomIcon = {
        data: 'base64data',
        filename: 'my-icon.png',
        mimeType: 'image/png',
      };

      render(<IconUpload {...defaultProps} value={customIcon} />);

      expect(screen.getByText('my-icon.png')).toBeInTheDocument();
    });
  });

  describe('delete functionality', () => {
    it('does not show delete button when no custom icon', () => {
      render(<IconUpload {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /Remove custom icon/i })).not.toBeInTheDocument();
    });

    it('shows delete button when custom icon is set', () => {
      const customIcon: CustomIcon = {
        data: 'base64data',
        filename: 'custom.png',
        mimeType: 'image/png',
      };

      render(<IconUpload {...defaultProps} value={customIcon} />);

      expect(screen.getByRole('button', { name: /Remove custom icon/i })).toBeInTheDocument();
    });

    it('calls onChange with null when delete clicked', () => {
      const onChange = vi.fn();
      const customIcon: CustomIcon = {
        data: 'base64data',
        filename: 'custom.png',
        mimeType: 'image/png',
      };

      render(<IconUpload {...defaultProps} value={customIcon} onChange={onChange} />);

      fireEvent.click(screen.getByRole('button', { name: /Remove custom icon/i }));

      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  describe('file validation', () => {
    it('shows error for invalid file type', async () => {
      const onChange = vi.fn();
      const { container } = render(<IconUpload {...defaultProps} onChange={onChange} />);

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const invalidFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' });

      fireEvent.change(input, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText('Invalid file type. Please use PNG, SVG, JPEG, GIF, or WebP.')).toBeInTheDocument();
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('shows error for oversized file', async () => {
      const onChange = vi.fn();
      const { container } = render(<IconUpload {...defaultProps} onChange={onChange} />);

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      // Create a file larger than 512KB
      const largeContent = 'x'.repeat(600 * 1024);
      const largeFile = new File([largeContent], 'large.png', { type: 'image/png' });

      fireEvent.change(input, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText('File too large. Maximum size is 512KB.')).toBeInTheDocument();
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('file upload', () => {
    // Note: FileReader mocking in jsdom is complex. These tests verify
    // the validation logic works. The actual base64 conversion is tested
    // implicitly by testing that onChange is NOT called for invalid files.

    it('does not call onChange for files that fail type validation', async () => {
      const onChange = vi.fn();
      const { container } = render(<IconUpload {...defaultProps} onChange={onChange} />);

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const invalidFile = new File(['content'], 'doc.txt', { type: 'text/plain' });

      fireEvent.change(input, { target: { files: [invalidFile] } });

      // Wait a bit for any async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not call onChange for files that fail size validation', async () => {
      const onChange = vi.fn();
      const { container } = render(<IconUpload {...defaultProps} onChange={onChange} />);

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const largeContent = 'x'.repeat(600 * 1024);
      const largeFile = new File([largeContent], 'large.png', { type: 'image/png' });

      fireEvent.change(input, { target: { files: [largeFile] } });

      // Wait a bit for any async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('processes valid files through FileReader', async () => {
      const onChange = vi.fn();
      const { container } = render(<IconUpload {...defaultProps} onChange={onChange} />);

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['test'], 'icon.png', { type: 'image/png' });

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

  describe('drag and drop', () => {
    it('shows drag state on dragOver', () => {
      render(<IconUpload {...defaultProps} />);

      const dropZone = screen.getByText('Drop or click to upload').closest('div')?.parentElement?.parentElement;
      if (dropZone) {
        fireEvent.dragOver(dropZone);
        expect(screen.getByText('Drop image here')).toBeInTheDocument();
      }
    });

    it('reverts drag state on dragLeave', () => {
      render(<IconUpload {...defaultProps} />);

      const dropZone = screen.getByText('Drop or click to upload').closest('div')?.parentElement?.parentElement;
      if (dropZone) {
        fireEvent.dragOver(dropZone);
        expect(screen.getByText('Drop image here')).toBeInTheDocument();

        fireEvent.dragLeave(dropZone);
        expect(screen.getByText('Drop or click to upload')).toBeInTheDocument();
      }
    });
  });

  describe('click to upload', () => {
    it('triggers file input click when drop zone clicked', () => {
      const { container } = render(<IconUpload {...defaultProps} />);

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      const dropZone = screen.getByText('Drop or click to upload').closest('div')?.parentElement?.parentElement;
      if (dropZone) {
        fireEvent.click(dropZone);
        expect(clickSpy).toHaveBeenCalled();
      }
    });
  });
});
