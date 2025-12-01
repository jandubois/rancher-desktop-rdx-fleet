/**
 * Tests for ImageCard component
 *
 * ImageCard displays static images with configurable URL or uploaded image:
 * - View mode: renders image with src and alt attributes
 * - View mode: renders bundled image from base64 data
 * - View mode: shows placeholder when no image configured
 * - View mode: optionally displays card title above image
 * - Edit mode: shows toggle between Upload and URL modes
 * - Edit mode: Upload mode with drag-and-drop and click-to-upload
 * - Edit mode: URL mode with URL input and live preview
 * - Edit mode: alt text input available in both modes
 * - Handles image load errors by hiding broken images
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageCard } from './ImageCard';
import { CardDefinition, ImageCardSettings } from '../manifest/types';

describe('ImageCard', () => {
  const defaultDefinition: CardDefinition = {
    id: 'test-image',
    type: 'image',
  };

  const defaultSettings: ImageCardSettings = {
    src: 'https://example.com/image.png',
    alt: 'Test image',
  };

  const bundledImageSettings: ImageCardSettings = {
    src: '/images/uploaded.png',
    alt: 'Uploaded image',
    bundledImage: {
      data: 'base64imagedata',
      filename: 'uploaded.png',
      mimeType: 'image/png',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode (editMode=false)', () => {
    it('renders image with correct src', () => {
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={false}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/image.png');
    });

    it('renders image with correct alt text', () => {
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={false}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('alt', 'Test image');
    });

    it('renders bundled image from base64 data', () => {
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={bundledImageSettings}
          editMode={false}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'data:image/png;base64,base64imagedata');
    });

    it('shows placeholder when no src provided', () => {
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '' }}
          editMode={false}
        />
      );

      expect(screen.getByText('No image configured')).toBeInTheDocument();
    });

    it('shows placeholder when settings has empty src', () => {
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '', alt: 'unused' }}
          editMode={false}
        />
      );

      expect(screen.getByText('No image configured')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('displays card title when provided in definition', () => {
      const definitionWithTitle: CardDefinition = {
        ...defaultDefinition,
        title: 'My Image',
      };

      render(
        <ImageCard
          definition={definitionWithTitle}
          settings={defaultSettings}
          editMode={false}
        />
      );

      expect(screen.getByText('My Image')).toBeInTheDocument();
    });

    it('does not display title when not provided', () => {
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={false}
        />
      );

      // Only the image should be present, no heading
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('handles empty alt text gracefully', () => {
      const { container } = render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: 'https://example.com/img.png', alt: '' }}
          editMode={false}
        />
      );

      // Images with empty alt have role="presentation", so use querySelector
      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', '');
    });
  });

  describe('edit mode - mode toggle', () => {
    it('shows upload and URL toggle buttons', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '', alt: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByRole('button', { name: /Upload Image/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Image URL/i })).toBeInTheDocument();
    });

    it('defaults to upload mode for new cards', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '', alt: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Drop or click to upload')).toBeInTheDocument();
      expect(screen.queryByLabelText(/Image URL/i)).not.toBeInTheDocument();
    });

    it('defaults to URL mode when card has external URL', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByLabelText(/Image URL/i)).toBeInTheDocument();
    });

    it('defaults to upload mode when card has bundled image', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={bundledImageSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText(bundledImageSettings.bundledImage!.filename)).toBeInTheDocument();
    });

    it('switches to URL mode when URL button clicked', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '', alt: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Image URL/i }));

      expect(screen.getByLabelText(/Image URL/i)).toBeInTheDocument();
    });
  });

  describe('edit mode - URL mode', () => {
    it('shows image URL input field', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByLabelText(/Image URL/i)).toBeInTheDocument();
    });

    it('shows alt text input field', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByLabelText(/Alt Text/i)).toBeInTheDocument();
    });

    it('pre-fills URL input with current value', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const urlInput = screen.getByLabelText(/Image URL/i);
      expect(urlInput).toHaveValue('https://example.com/image.png');
    });

    it('pre-fills alt text input with current value', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const altInput = screen.getByLabelText(/Alt Text/i);
      expect(altInput).toHaveValue('Test image');
    });

    it('calls onSettingsChange when URL is edited', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const urlInput = screen.getByLabelText(/Image URL/i);
      fireEvent.change(urlInput, { target: { value: 'https://new-url.com/img.jpg' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        src: 'https://new-url.com/img.jpg',
        alt: 'Test image',
        bundledImage: undefined,
      });
    });

    it('calls onSettingsChange when alt text is edited', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const altInput = screen.getByLabelText(/Alt Text/i);
      fireEvent.change(altInput, { target: { value: 'New description' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        src: 'https://example.com/image.png',
        alt: 'New description',
      });
    });

    it('shows preview section when URL is provided', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Preview:')).toBeInTheDocument();
    });

    it('does not show preview when URL is empty', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '', alt: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // Switch to URL mode first
      fireEvent.click(screen.getByRole('button', { name: /Image URL/i }));

      expect(screen.queryByText('Preview:')).not.toBeInTheDocument();
    });

    it('shows preview image with current URL', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const images = screen.getAllByRole('img');
      expect(images.some(img => img.getAttribute('src') === 'https://example.com/image.png')).toBe(true);
    });

    it('displays card title in edit mode when provided', () => {
      const onSettingsChange = vi.fn();
      const definitionWithTitle: CardDefinition = {
        ...defaultDefinition,
        title: 'Edit Mode Title',
      };

      render(
        <ImageCard
          definition={definitionWithTitle}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Edit Mode Title')).toBeInTheDocument();
    });

    it('shows URL placeholder text', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '', alt: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // Switch to URL mode
      fireEvent.click(screen.getByRole('button', { name: /Image URL/i }));

      const urlInput = screen.getByLabelText(/Image URL/i);
      expect(urlInput).toHaveAttribute('placeholder', 'https://example.com/image.png');
    });

    it('shows alt text placeholder', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '', alt: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const altInput = screen.getByLabelText(/Alt Text/i);
      expect(altInput).toHaveAttribute('placeholder', 'Description of the image');
    });
  });

  describe('edit mode - upload mode', () => {
    it('renders upload drop zone', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '', alt: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Drop or click to upload')).toBeInTheDocument();
    });

    it('renders accepted file types hint', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '', alt: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('PNG, SVG, JPEG, GIF, WebP (max 2MB)')).toBeInTheDocument();
    });

    it('renders hidden file input', () => {
      const onSettingsChange = vi.fn();
      const { container } = render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '', alt: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = container.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      expect(input).toHaveStyle({ display: 'none' });
    });

    it('shows uploaded image preview', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={bundledImageSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const images = screen.getAllByRole('img');
      expect(images.some(img => img.getAttribute('src') === 'data:image/png;base64,base64imagedata')).toBe(true);
    });

    it('shows filename when image is uploaded', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={bundledImageSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('uploaded.png')).toBeInTheDocument();
    });

    it('shows remove button when image is uploaded', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={bundledImageSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByRole('button', { name: /Remove image/i })).toBeInTheDocument();
    });

    it('calls onSettingsChange with cleared image when remove clicked', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={bundledImageSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Remove image/i }));

      expect(onSettingsChange).toHaveBeenCalledWith({
        src: '',
        alt: 'Uploaded image',
        bundledImage: undefined,
      });
    });

    it('shows drag state on dragOver', () => {
      const onSettingsChange = vi.fn();
      const { container } = render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '', alt: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // Find the Paper drop zone by its MuiPaper class
      const dropZone = container.querySelector('.MuiPaper-root');
      expect(dropZone).toBeInTheDocument();
      if (dropZone) {
        fireEvent.dragOver(dropZone);
        expect(screen.getByText('Drop image here')).toBeInTheDocument();
      }
    });

    it('reverts drag state on dragLeave', () => {
      const onSettingsChange = vi.fn();
      const { container } = render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: '', alt: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // Find the Paper drop zone by its MuiPaper class
      const dropZone = container.querySelector('.MuiPaper-root');
      expect(dropZone).toBeInTheDocument();
      if (dropZone) {
        fireEvent.dragOver(dropZone);
        expect(screen.getByText('Drop image here')).toBeInTheDocument();

        fireEvent.dragLeave(dropZone);
        expect(screen.getByText('Drop or click to upload')).toBeInTheDocument();
      }
    });

    it('shows "Drop or click to replace" when image already uploaded', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={bundledImageSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Drop or click to replace')).toBeInTheDocument();
    });
  });

  describe('edit mode - mode switching', () => {
    it('clears bundled image when switching to URL mode', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={bundledImageSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Image URL/i }));

      expect(onSettingsChange).toHaveBeenCalledWith({
        src: '',
        alt: 'Uploaded image',
        bundledImage: undefined,
      });
    });
  });

  describe('edit mode - no onSettingsChange', () => {
    it('renders in view mode when editMode true but no onSettingsChange', () => {
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          // No onSettingsChange provided
        />
      );

      // Should show image, not edit fields
      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Upload Image/i })).not.toBeInTheDocument();
    });
  });

  describe('image error handling', () => {
    it('handles onError event on preview image', () => {
      const onSettingsChange = vi.fn();
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: 'https://broken-url.com/404.png', alt: 'Broken' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const images = screen.getAllByRole('img');
      const previewImg = images.find(img => img.getAttribute('src') === 'https://broken-url.com/404.png');

      // Simulate image load error
      if (previewImg) {
        fireEvent.error(previewImg);
        // After error, image should be hidden (style.display = 'none')
        expect(previewImg).toHaveStyle({ display: 'none' });
      }
    });
  });

  describe('default values', () => {
    it('handles undefined settings gracefully', () => {
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={undefined as unknown as ImageCardSettings}
          editMode={false}
        />
      );

      expect(screen.getByText('No image configured')).toBeInTheDocument();
    });

    it('handles missing alt in settings', () => {
      const { container } = render(
        <ImageCard
          definition={defaultDefinition}
          settings={{ src: 'https://example.com/img.png' } as ImageCardSettings}
          editMode={false}
        />
      );

      // Images with empty alt have role="presentation", so use querySelector
      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('alt', '');
    });

    it('defaults editMode to false', () => {
      render(
        <ImageCard
          definition={defaultDefinition}
          settings={defaultSettings}
        />
      );

      // Should be in view mode (showing image, not inputs)
      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Upload Image/i })).not.toBeInTheDocument();
    });
  });
});
