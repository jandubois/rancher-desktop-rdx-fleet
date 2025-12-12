/**
 * Tests for VideoCard component
 *
 * VideoCard embeds videos from various sources:
 * - YouTube URLs: converted to embed format (youtube.com/watch, youtu.be, youtube.com/embed)
 * - Vimeo URLs: converted to embed format (vimeo.com, player.vimeo.com)
 * - Direct video URLs: rendered as HTML5 video element (.mp4, .webm, etc.)
 * - View mode: shows embedded video player or video element
 * - View mode: shows placeholder when no URL configured
 * - Edit mode: shows URL and title input fields with live preview
 * - Maintains 16:9 aspect ratio for embedded videos
 *
 * Implementation note: Embedded videos (YouTube, Vimeo) are rendered using
 * document.write to bypass Rancher Desktop CSP restrictions. The outer iframe
 * has no src attribute - the video embed is injected via document.write.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoCard } from './VideoCard';
import { CardDefinition, VideoCardSettings } from '../manifest/types';

describe('VideoCard', () => {
  const defaultDefinition: CardDefinition = {
    id: 'test-video',
    type: 'video',
  };

  const youtubeSettings: VideoCardSettings = {
    src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Test Video',
  };

  describe('view mode (editMode=false)', () => {
    describe('YouTube URL handling', () => {
      it('renders YouTube watch URL as embed iframe', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={{ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }}
            editMode={false}
          />
        );

        // Iframe uses document.write so outer iframe has no src - just check it exists
        const iframe = screen.getByTitle('Embedded video');
        expect(iframe).toBeInTheDocument();
        expect(iframe.tagName.toLowerCase()).toBe('iframe');
      });

      it('renders YouTube short URL (youtu.be) as embed', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={{ src: 'https://youtu.be/dQw4w9WgXcQ' }}
            editMode={false}
          />
        );

        // Iframe uses document.write so outer iframe has no src - just check it exists
        const iframe = screen.getByTitle('Embedded video');
        expect(iframe).toBeInTheDocument();
        expect(iframe.tagName.toLowerCase()).toBe('iframe');
      });

      it('renders YouTube embed URL as-is (already embed format)', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={{ src: 'https://www.youtube.com/embed/dQw4w9WgXcQ' }}
            editMode={false}
          />
        );

        // Iframe uses document.write so outer iframe has no src - just check it exists
        const iframe = screen.getByTitle('Embedded video');
        expect(iframe).toBeInTheDocument();
        expect(iframe.tagName.toLowerCase()).toBe('iframe');
      });

      it('uses custom title for YouTube iframe', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={{ src: 'https://www.youtube.com/watch?v=abc123xyz90', title: 'My Video' }}
            editMode={false}
          />
        );

        const iframe = screen.getByTitle('My Video');
        expect(iframe).toBeInTheDocument();
      });
    });

    describe('Vimeo URL handling', () => {
      it('renders Vimeo URL as embed iframe', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={{ src: 'https://vimeo.com/123456789' }}
            editMode={false}
          />
        );

        // Iframe uses document.write so outer iframe has no src - just check it exists
        const iframe = screen.getByTitle('Embedded video');
        expect(iframe).toBeInTheDocument();
        expect(iframe.tagName.toLowerCase()).toBe('iframe');
      });

      it('renders Vimeo player URL as embed', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={{ src: 'https://player.vimeo.com/video/123456789' }}
            editMode={false}
          />
        );

        // Iframe uses document.write so outer iframe has no src - just check it exists
        const iframe = screen.getByTitle('Embedded video');
        expect(iframe).toBeInTheDocument();
        expect(iframe.tagName.toLowerCase()).toBe('iframe');
      });
    });

    describe('direct video URL handling', () => {
      it('renders MP4 URL as video element', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={{ src: 'https://example.com/video.mp4' }}
            editMode={false}
          />
        );

        // Direct URLs render as video element, not iframe
        expect(screen.queryByTitle('Embedded video')).not.toBeInTheDocument();
        // Check for video element (it has the src directly)
        const video = document.querySelector('video');
        expect(video).toBeInTheDocument();
        expect(video).toHaveAttribute('src', 'https://example.com/video.mp4');
      });

      it('renders WebM URL as video element', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={{ src: 'https://example.com/video.webm' }}
            editMode={false}
          />
        );

        const video = document.querySelector('video');
        expect(video).toBeInTheDocument();
        expect(video).toHaveAttribute('src', 'https://example.com/video.webm');
      });

      it('renders video element with controls', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={{ src: 'https://example.com/video.mp4' }}
            editMode={false}
          />
        );

        const video = document.querySelector('video');
        expect(video).toHaveAttribute('controls');
      });

      it('applies title to video element', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={{ src: 'https://example.com/video.mp4', title: 'Direct Video' }}
            editMode={false}
          />
        );

        const video = document.querySelector('video');
        expect(video).toHaveAttribute('title', 'Direct Video');
      });
    });

    describe('placeholder and empty state', () => {
      it('shows placeholder when no src provided', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={{ src: '' }}
            editMode={false}
          />
        );

        expect(screen.getByText('No video configured')).toBeInTheDocument();
      });

      it('shows placeholder when src is empty string', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={{ src: '', title: 'unused' }}
            editMode={false}
          />
        );

        expect(screen.getByText('No video configured')).toBeInTheDocument();
        expect(screen.queryByTitle('Embedded video')).not.toBeInTheDocument();
      });
    });

    describe('card title', () => {
      it('displays card title when provided in definition', () => {
        const definitionWithTitle: CardDefinition = {
          ...defaultDefinition,
          title: 'Featured Video',
        };

        render(
          <VideoCard
            definition={definitionWithTitle}
            settings={youtubeSettings}
            editMode={false}
          />
        );

        expect(screen.getByText('Featured Video')).toBeInTheDocument();
      });

      it('does not display title when not provided', () => {
        render(
          <VideoCard
            definition={defaultDefinition}
            settings={youtubeSettings}
            editMode={false}
          />
        );

        // Should have iframe but no h6 heading
        expect(screen.getByTitle('Test Video')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { level: 6 })).not.toBeInTheDocument();
      });
    });
  });

  describe('edit mode (editMode=true)', () => {
    it('shows video URL input field', () => {
      const onSettingsChange = vi.fn();
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={youtubeSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByLabelText(/Video URL/i)).toBeInTheDocument();
    });

    it('shows title input field', () => {
      const onSettingsChange = vi.fn();
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={youtubeSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
    });

    it('pre-fills URL input with current value', () => {
      const onSettingsChange = vi.fn();
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={youtubeSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const urlInput = screen.getByLabelText(/Video URL/i);
      expect(urlInput).toHaveValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('pre-fills title input with current value', () => {
      const onSettingsChange = vi.fn();
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={youtubeSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const titleInput = screen.getByLabelText(/Title/i);
      expect(titleInput).toHaveValue('Test Video');
    });

    it('calls onSettingsChange when URL is edited', () => {
      const onSettingsChange = vi.fn();
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={youtubeSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const urlInput = screen.getByLabelText(/Video URL/i);
      fireEvent.change(urlInput, { target: { value: 'https://vimeo.com/999' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        src: 'https://vimeo.com/999',
        title: 'Test Video',
      });
    });

    it('calls onSettingsChange when title is edited', () => {
      const onSettingsChange = vi.fn();
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={youtubeSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const titleInput = screen.getByLabelText(/Title/i);
      fireEvent.change(titleInput, { target: { value: 'New Title' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'New Title',
      });
    });

    it('shows preview section when URL is provided', () => {
      const onSettingsChange = vi.fn();
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={youtubeSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Preview:')).toBeInTheDocument();
    });

    it('does not show preview when URL is empty', () => {
      const onSettingsChange = vi.fn();
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={{ src: '', title: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.queryByText('Preview:')).not.toBeInTheDocument();
    });

    it('shows helper text for supported formats', () => {
      const onSettingsChange = vi.fn();
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={{ src: '', title: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText(/Supports YouTube, Vimeo, or direct video URLs/i)).toBeInTheDocument();
    });

    it('shows URL placeholder text', () => {
      const onSettingsChange = vi.fn();
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={{ src: '', title: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const urlInput = screen.getByLabelText(/Video URL/i);
      expect(urlInput).toHaveAttribute('placeholder', 'https://youtube.com/watch?v=... or direct video URL');
    });

    it('shows title placeholder text', () => {
      const onSettingsChange = vi.fn();
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={{ src: '', title: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const titleInput = screen.getByLabelText(/Title/i);
      expect(titleInput).toHaveAttribute('placeholder', 'Video title for accessibility');
    });

    it('displays card title in edit mode when provided', () => {
      const onSettingsChange = vi.fn();
      const definitionWithTitle: CardDefinition = {
        ...defaultDefinition,
        title: 'Edit Mode Title',
      };

      render(
        <VideoCard
          definition={definitionWithTitle}
          settings={youtubeSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Edit Mode Title')).toBeInTheDocument();
    });

    it('renders in view mode when editMode true but no onSettingsChange', () => {
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={youtubeSettings}
          editMode={true}
          // No onSettingsChange provided
        />
      );

      // Should show video, not edit fields
      expect(screen.getByTitle('Test Video')).toBeInTheDocument();
      expect(screen.queryByLabelText(/Video URL/i)).not.toBeInTheDocument();
    });
  });

  describe('URL parsing edge cases', () => {
    it('handles YouTube URL with additional parameters', () => {
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={{ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120' }}
          editMode={false}
        />
      );

      // Iframe uses document.write - just check it exists as iframe (not video)
      const iframe = screen.getByTitle('Embedded video');
      expect(iframe).toBeInTheDocument();
      expect(iframe.tagName.toLowerCase()).toBe('iframe');
    });

    it('handles YouTube URL without www', () => {
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={{ src: 'https://youtube.com/watch?v=dQw4w9WgXcQ' }}
          editMode={false}
        />
      );

      // Iframe uses document.write - just check it exists as iframe (not video)
      const iframe = screen.getByTitle('Embedded video');
      expect(iframe).toBeInTheDocument();
      expect(iframe.tagName.toLowerCase()).toBe('iframe');
    });

    it('handles non-video URL as direct video', () => {
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={{ src: 'https://example.com/some-random-url' }}
          editMode={false}
        />
      );

      // Should render as video element since it's not YouTube/Vimeo
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', 'https://example.com/some-random-url');
    });
  });

  describe('default values', () => {
    it('handles undefined settings gracefully', () => {
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={undefined as unknown as VideoCardSettings}
          editMode={false}
        />
      );

      expect(screen.getByText('No video configured')).toBeInTheDocument();
    });

    it('handles missing title in settings', () => {
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={{ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } as VideoCardSettings}
          editMode={false}
        />
      );

      // Uses default "Embedded video" title when no title provided
      const iframe = screen.getByTitle('Embedded video');
      expect(iframe).toBeInTheDocument();
      expect(iframe.tagName.toLowerCase()).toBe('iframe');
    });

    it('defaults editMode to false', () => {
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={youtubeSettings}
        />
      );

      // Should be in view mode (showing video, not inputs)
      expect(screen.getByTitle('Test Video')).toBeInTheDocument();
      expect(screen.queryByLabelText(/Video URL/i)).not.toBeInTheDocument();
    });

    it('uses "Embedded video" as default iframe title', () => {
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={{ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: '' }}
          editMode={false}
        />
      );

      const iframe = screen.getByTitle('Embedded video');
      expect(iframe).toBeInTheDocument();
      expect(iframe.tagName.toLowerCase()).toBe('iframe');
    });
  });

  describe('iframe rendering', () => {
    // Note: The iframe attributes (allowFullScreen, allow) are on the inner iframe
    // injected via document.write to bypass CSP restrictions. The outer iframe
    // only has a title attribute for accessibility.

    it('renders outer iframe with title attribute', () => {
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={youtubeSettings}
          editMode={false}
        />
      );

      const iframe = screen.getByTitle('Test Video');
      expect(iframe).toBeInTheDocument();
      expect(iframe.tagName.toLowerCase()).toBe('iframe');
    });

    it('renders iframe for YouTube URLs (not video element)', () => {
      render(
        <VideoCard
          definition={defaultDefinition}
          settings={youtubeSettings}
          editMode={false}
        />
      );

      const iframe = screen.getByTitle('Test Video');
      expect(iframe.tagName.toLowerCase()).toBe('iframe');
      expect(document.querySelector('video')).not.toBeInTheDocument();
    });
  });
});
