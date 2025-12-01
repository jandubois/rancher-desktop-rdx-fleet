/**
 * Tests for HtmlCard component
 *
 * HtmlCard renders raw HTML content with script support via iframe:
 * - View mode: renders HTML in an iframe using document.write
 * - View mode: returns null when content is empty
 * - View mode: optionally displays card title above iframe
 * - Edit mode: shows multiline text area for HTML input (monospace font)
 * - Edit mode: shows live preview in iframe when content provided
 * - Auto-resizes iframe based on content height
 * - Wraps content in basic HTML document structure if not already present
 *
 * Note: Testing iframe document.write behavior is complex in jsdom,
 * so we focus on component structure and user interactions.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HtmlCard } from './HtmlCard';
import { CardDefinition, HtmlCardSettings } from '../manifest/types';

describe('HtmlCard', () => {
  const defaultDefinition: CardDefinition = {
    id: 'test-html',
    type: 'html',
  };

  const defaultSettings: HtmlCardSettings = {
    content: '<p>Hello World</p>',
  };

  describe('view mode (editMode=false)', () => {
    it('renders iframe when content is provided', () => {
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={false}
        />
      );

      const iframe = document.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
    });

    it('returns null when content is empty', () => {
      const { container } = render(
        <HtmlCard
          definition={defaultDefinition}
          settings={{ content: '' }}
          editMode={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when content is missing', () => {
      const { container } = render(
        <HtmlCard
          definition={defaultDefinition}
          settings={{} as HtmlCardSettings}
          editMode={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('displays card title when provided', () => {
      const definitionWithTitle: CardDefinition = {
        ...defaultDefinition,
        title: 'HTML Widget',
      };

      render(
        <HtmlCard
          definition={definitionWithTitle}
          settings={defaultSettings}
          editMode={false}
        />
      );

      expect(screen.getByText('HTML Widget')).toBeInTheDocument();
    });

    it('does not display title when not provided', () => {
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={false}
        />
      );

      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('sets iframe title from definition title', () => {
      const definitionWithTitle: CardDefinition = {
        ...defaultDefinition,
        title: 'My Widget',
      };

      render(
        <HtmlCard
          definition={definitionWithTitle}
          settings={defaultSettings}
          editMode={false}
        />
      );

      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveAttribute('title', 'My Widget');
    });

    it('uses default iframe title when no definition title', () => {
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={false}
        />
      );

      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveAttribute('title', 'HTML content');
    });
  });

  describe('edit mode (editMode=true)', () => {
    it('shows multiline text area', () => {
      const onSettingsChange = vi.fn();
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const textArea = screen.getByRole('textbox');
      expect(textArea).toBeInTheDocument();
    });

    it('pre-fills text area with current content', () => {
      const onSettingsChange = vi.fn();
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={{ content: '<div>Existing HTML</div>' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const textArea = screen.getByRole('textbox');
      expect(textArea).toHaveValue('<div>Existing HTML</div>');
    });

    it('calls onSettingsChange when content is edited', () => {
      const onSettingsChange = vi.fn();
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={{ content: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const textArea = screen.getByRole('textbox');
      fireEvent.change(textArea, { target: { value: '<h1>New Content</h1>' } });

      expect(onSettingsChange).toHaveBeenCalledWith({ content: '<h1>New Content</h1>' });
    });

    it('shows placeholder text', () => {
      const onSettingsChange = vi.fn();
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={{ content: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const textArea = screen.getByRole('textbox');
      expect(textArea).toHaveAttribute('placeholder', 'Enter HTML content (scripts allowed)...');
    });

    it('shows preview section when content is provided', () => {
      const onSettingsChange = vi.fn();
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Preview:')).toBeInTheDocument();
    });

    it('does not show preview when content is empty', () => {
      const onSettingsChange = vi.fn();
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={{ content: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.queryByText('Preview:')).not.toBeInTheDocument();
    });

    it('displays card title in edit mode when provided', () => {
      const onSettingsChange = vi.fn();
      const definitionWithTitle: CardDefinition = {
        ...defaultDefinition,
        title: 'Edit Mode Title',
      };

      render(
        <HtmlCard
          definition={definitionWithTitle}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Edit Mode Title')).toBeInTheDocument();
    });

    it('renders iframe in preview when content provided', () => {
      const onSettingsChange = vi.fn();
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const iframe = document.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
    });

    it('sets preview iframe title from definition title', () => {
      const onSettingsChange = vi.fn();
      const definitionWithTitle: CardDefinition = {
        ...defaultDefinition,
        title: 'Preview Widget',
      };

      render(
        <HtmlCard
          definition={definitionWithTitle}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveAttribute('title', 'Preview Widget');
    });

    it('uses "HTML preview" as default preview iframe title', () => {
      const onSettingsChange = vi.fn();
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveAttribute('title', 'HTML preview');
    });

    it('renders in view mode when editMode true but no onSettingsChange', () => {
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          // No onSettingsChange provided
        />
      );

      // Should render iframe but not text area
      const iframe = document.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('default values', () => {
    it('handles undefined settings gracefully', () => {
      const { container } = render(
        <HtmlCard
          definition={defaultDefinition}
          settings={undefined as unknown as HtmlCardSettings}
          editMode={false}
        />
      );

      // Should return null for empty content
      expect(container.firstChild).toBeNull();
    });

    it('defaults editMode to false', () => {
      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={defaultSettings}
        />
      );

      // Should be in view mode (iframe, not textarea)
      const iframe = document.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('content preservation', () => {
    it('preserves existing settings when updating content', () => {
      const onSettingsChange = vi.fn();
      const settings = { content: 'old' };

      render(
        <HtmlCard
          definition={defaultDefinition}
          settings={settings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const textArea = screen.getByRole('textbox');
      fireEvent.change(textArea, { target: { value: 'new' } });

      expect(onSettingsChange).toHaveBeenCalledWith({ content: 'new' });
    });
  });
});
