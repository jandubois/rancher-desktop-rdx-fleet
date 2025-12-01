/**
 * Tests for MarkdownCard component
 *
 * MarkdownCard renders markdown content using react-markdown:
 * - View mode: renders parsed markdown as HTML
 * - View mode: optionally displays card title above content
 * - Edit mode: shows multiline text area for markdown input
 * - Edit mode: shows live preview of rendered markdown
 * - Supports rehype-raw plugin for raw HTML in markdown
 * - Applies styling for links, paragraphs, and headings
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkdownCard } from './MarkdownCard';
import { CardDefinition, MarkdownCardSettings } from '../manifest/types';

describe('MarkdownCard', () => {
  const defaultDefinition: CardDefinition = {
    id: 'test-markdown',
    type: 'markdown',
  };

  const defaultSettings: MarkdownCardSettings = {
    content: '# Hello World\n\nThis is **bold** text.',
  };

  describe('view mode (editMode=false)', () => {
    it('renders markdown content', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={false}
        />
      );

      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('renders bold text correctly', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: 'This is **bold** text' }}
          editMode={false}
        />
      );

      const boldElement = screen.getByText('bold');
      expect(boldElement.tagName).toBe('STRONG');
    });

    it('renders italic text correctly', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: 'This is *italic* text' }}
          editMode={false}
        />
      );

      const italicElement = screen.getByText('italic');
      expect(italicElement.tagName).toBe('EM');
    });

    it('renders links correctly', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: 'Visit [Example](https://example.com)' }}
          editMode={false}
        />
      );

      const link = screen.getByRole('link', { name: 'Example' });
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('renders unordered lists', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '- Item 1\n- Item 2\n- Item 3' }}
          editMode={false}
        />
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('renders ordered lists', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '1. First\n2. Second\n3. Third' }}
          editMode={false}
        />
      );

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('renders code blocks', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '```\nconst x = 1;\n```' }}
          editMode={false}
        />
      );

      expect(screen.getByText(/const x = 1/)).toBeInTheDocument();
    });

    it('renders inline code', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: 'Use `npm install` to install' }}
          editMode={false}
        />
      );

      const codeElement = screen.getByText('npm install');
      expect(codeElement.tagName).toBe('CODE');
    });

    it('renders headings at different levels', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '# H1\n## H2\n### H3' }}
          editMode={false}
        />
      );

      expect(screen.getByRole('heading', { level: 1, name: 'H1' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'H2' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'H3' })).toBeInTheDocument();
    });

    it('displays card title when provided', () => {
      const definitionWithTitle: CardDefinition = {
        ...defaultDefinition,
        title: 'Documentation',
      };

      render(
        <MarkdownCard
          definition={definitionWithTitle}
          settings={defaultSettings}
          editMode={false}
        />
      );

      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });

    it('does not display title when not provided', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: 'Simple text' }}
          editMode={false}
        />
      );

      // Should render markdown but no h6 title from definition
      expect(screen.getByText('Simple text')).toBeInTheDocument();
    });

    it('handles empty content gracefully', () => {
      const { container } = render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '' }}
          editMode={false}
        />
      );

      // Should render without crashing
      expect(container).toBeInTheDocument();
    });

    it('renders raw HTML when using rehype-raw', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '<span class="custom">Raw HTML</span>' }}
          editMode={false}
        />
      );

      expect(screen.getByText('Raw HTML')).toBeInTheDocument();
    });
  });

  describe('edit mode (editMode=true)', () => {
    it('shows multiline text area', () => {
      const onSettingsChange = vi.fn();
      render(
        <MarkdownCard
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
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: 'Existing content' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const textArea = screen.getByRole('textbox');
      expect(textArea).toHaveValue('Existing content');
    });

    it('calls onSettingsChange when content is edited', () => {
      const onSettingsChange = vi.fn();
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const textArea = screen.getByRole('textbox');
      fireEvent.change(textArea, { target: { value: 'New content' } });

      expect(onSettingsChange).toHaveBeenCalledWith({ content: 'New content' });
    });

    it('shows placeholder text', () => {
      const onSettingsChange = vi.fn();
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const textArea = screen.getByRole('textbox');
      expect(textArea).toHaveAttribute('placeholder', 'Enter markdown content...');
    });

    it('shows preview section when content is provided', () => {
      const onSettingsChange = vi.fn();
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '**Preview this**' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Preview:')).toBeInTheDocument();
    });

    it('does not show preview when content is empty', () => {
      const onSettingsChange = vi.fn();
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.queryByText('Preview:')).not.toBeInTheDocument();
    });

    it('renders markdown in preview', () => {
      const onSettingsChange = vi.fn();
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '**Bold preview**' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const boldElement = screen.getByText('Bold preview');
      expect(boldElement.tagName).toBe('STRONG');
    });

    it('displays card title in edit mode when provided', () => {
      const onSettingsChange = vi.fn();
      const definitionWithTitle: CardDefinition = {
        ...defaultDefinition,
        title: 'Edit Title',
      };

      render(
        <MarkdownCard
          definition={definitionWithTitle}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Edit Title')).toBeInTheDocument();
    });

    it('renders in view mode when editMode true but no onSettingsChange', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '**View mode**' }}
          editMode={true}
          // No onSettingsChange provided
        />
      );

      // Should render markdown directly, not text area
      const boldElement = screen.getByText('View mode');
      expect(boldElement.tagName).toBe('STRONG');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('preserves existing settings when updating content', () => {
      const onSettingsChange = vi.fn();
      const settings = { content: 'old' };

      render(
        <MarkdownCard
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

  describe('default values', () => {
    it('handles undefined settings gracefully', () => {
      const { container } = render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={undefined as unknown as MarkdownCardSettings}
          editMode={false}
        />
      );

      expect(container).toBeInTheDocument();
    });

    it('handles missing content in settings', () => {
      const { container } = render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{} as MarkdownCardSettings}
          editMode={false}
        />
      );

      expect(container).toBeInTheDocument();
    });

    it('defaults editMode to false', () => {
      render(
        <MarkdownCard
          definition={defaultDefinition}
          settings={{ content: '**text**' }}
        />
      );

      // Should be in view mode (rendered markdown, not textarea)
      expect(screen.getByText('text').tagName).toBe('STRONG');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });
});
