/**
 * Tests for LinkCard component
 *
 * LinkCard displays a collection of links with two display variants:
 * - Buttons variant: renders links as outlined buttons with icons
 * - List variant: renders links as a list with clickable items
 * - View mode: shows valid links only (both label and url required)
 * - View mode: shows placeholder when no links or no valid links
 * - Edit mode: shows link editor with add/remove/edit functionality
 * - Edit mode: shows variant toggle (buttons/list)
 * - All links open in new tab with noopener noreferrer
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkCard } from './LinkCard';
import { CardDefinition, LinkCardSettings } from '../manifest/types';

describe('LinkCard', () => {
  const defaultDefinition: CardDefinition = {
    id: 'test-link',
    type: 'link',
  };

  const defaultSettings: LinkCardSettings = {
    links: [
      { label: 'Google', url: 'https://google.com' },
      { label: 'GitHub', url: 'https://github.com' },
    ],
    variant: 'buttons',
  };

  describe('view mode (editMode=false)', () => {
    describe('buttons variant', () => {
      it('renders links as buttons', () => {
        render(
          <LinkCard
            definition={defaultDefinition}
            settings={defaultSettings}
            editMode={false}
          />
        );

        expect(screen.getByRole('link', { name: /Google/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /GitHub/i })).toBeInTheDocument();
      });

      it('buttons have correct href', () => {
        render(
          <LinkCard
            definition={defaultDefinition}
            settings={defaultSettings}
            editMode={false}
          />
        );

        const googleLink = screen.getByRole('link', { name: /Google/i });
        expect(googleLink).toHaveAttribute('href', 'https://google.com');
      });

      it('buttons open in new tab', () => {
        render(
          <LinkCard
            definition={defaultDefinition}
            settings={defaultSettings}
            editMode={false}
          />
        );

        const googleLink = screen.getByRole('link', { name: /Google/i });
        expect(googleLink).toHaveAttribute('target', '_blank');
        expect(googleLink).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    describe('list variant', () => {
      it('renders links as list items', () => {
        render(
          <LinkCard
            definition={defaultDefinition}
            settings={{ ...defaultSettings, variant: 'list' }}
            editMode={false}
          />
        );

        expect(screen.getByRole('link', { name: /Google/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /GitHub/i })).toBeInTheDocument();
      });

      it('list items have correct href', () => {
        render(
          <LinkCard
            definition={defaultDefinition}
            settings={{ ...defaultSettings, variant: 'list' }}
            editMode={false}
          />
        );

        const googleLink = screen.getByRole('link', { name: /Google/i });
        expect(googleLink).toHaveAttribute('href', 'https://google.com');
      });

      it('list items open in new tab', () => {
        render(
          <LinkCard
            definition={defaultDefinition}
            settings={{ ...defaultSettings, variant: 'list' }}
            editMode={false}
          />
        );

        const googleLink = screen.getByRole('link', { name: /Google/i });
        expect(googleLink).toHaveAttribute('target', '_blank');
        expect(googleLink).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    describe('placeholder states', () => {
      it('shows placeholder when links array is empty', () => {
        render(
          <LinkCard
            definition={defaultDefinition}
            settings={{ links: [] }}
            editMode={false}
          />
        );

        expect(screen.getByText('No links configured')).toBeInTheDocument();
      });

      it('shows placeholder when no valid links (empty labels)', () => {
        render(
          <LinkCard
            definition={defaultDefinition}
            settings={{ links: [{ label: '', url: 'https://example.com' }] }}
            editMode={false}
          />
        );

        expect(screen.getByText('No valid links')).toBeInTheDocument();
      });

      it('shows placeholder when no valid links (empty urls)', () => {
        render(
          <LinkCard
            definition={defaultDefinition}
            settings={{ links: [{ label: 'Example', url: '' }] }}
            editMode={false}
          />
        );

        expect(screen.getByText('No valid links')).toBeInTheDocument();
      });

      it('filters out invalid links and shows valid ones', () => {
        render(
          <LinkCard
            definition={defaultDefinition}
            settings={{
              links: [
                { label: 'First Link', url: 'https://first.com' },
                { label: '', url: 'https://invalid.com' },
                { label: 'Second Link', url: 'https://second.com' },
              ],
            }}
            editMode={false}
          />
        );

        expect(screen.getByRole('link', { name: /First Link/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Second Link/i })).toBeInTheDocument();
        expect(screen.queryByText('No valid links')).not.toBeInTheDocument();
      });
    });

    describe('card title', () => {
      it('displays card title when provided', () => {
        const definitionWithTitle: CardDefinition = {
          ...defaultDefinition,
          title: 'Useful Links',
        };

        render(
          <LinkCard
            definition={definitionWithTitle}
            settings={defaultSettings}
            editMode={false}
          />
        );

        expect(screen.getByText('Useful Links')).toBeInTheDocument();
      });

      it('does not display title when not provided', () => {
        render(
          <LinkCard
            definition={defaultDefinition}
            settings={defaultSettings}
            editMode={false}
          />
        );

        expect(screen.queryByRole('heading', { level: 6 })).not.toBeInTheDocument();
      });
    });
  });

  describe('edit mode (editMode=true)', () => {
    it('shows display style label', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Display Style:')).toBeInTheDocument();
    });

    it('shows variant toggle buttons', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByRole('button', { name: 'Buttons' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument();
    });

    it('highlights current variant', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={{ ...defaultSettings, variant: 'buttons' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const buttonsToggle = screen.getByRole('button', { name: 'Buttons' });
      expect(buttonsToggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onSettingsChange when variant changed to list', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={{ ...defaultSettings, variant: 'buttons' }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'List' }));

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        variant: 'list',
      });
    });

    it('shows link editor for each link', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // Should have 2 label inputs and 2 URL inputs
      const labelInputs = screen.getAllByLabelText('Label');
      const urlInputs = screen.getAllByLabelText('URL');

      expect(labelInputs).toHaveLength(2);
      expect(urlInputs).toHaveLength(2);
    });

    it('pre-fills link inputs with current values', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const labelInputs = screen.getAllByLabelText('Label');
      expect(labelInputs[0]).toHaveValue('Google');
      expect(labelInputs[1]).toHaveValue('GitHub');
    });

    it('calls onSettingsChange when link label is edited', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const labelInputs = screen.getAllByLabelText('Label');
      fireEvent.change(labelInputs[0], { target: { value: 'New Label' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        links: [
          { label: 'New Label', url: 'https://google.com' },
          { label: 'GitHub', url: 'https://github.com' },
        ],
      });
    });

    it('calls onSettingsChange when link URL is edited', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const urlInputs = screen.getAllByLabelText('URL');
      fireEvent.change(urlInputs[0], { target: { value: 'https://new-url.com' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        links: [
          { label: 'Google', url: 'https://new-url.com' },
          { label: 'GitHub', url: 'https://github.com' },
        ],
      });
    });

    it('shows Add Link button', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByRole('button', { name: /Add Link/i })).toBeInTheDocument();
    });

    it('adds new link when Add Link clicked', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Add Link/i }));

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        links: [
          ...defaultSettings.links,
          { label: '', url: '' },
        ],
      });
    });

    it('shows delete button for each link', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // There should be delete buttons (one for each link)
      const deleteButtons = screen.getAllByRole('button').filter(
        btn => btn.querySelector('svg[data-testid="DeleteIcon"]')
      );
      expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('removes link when delete button clicked', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      // Find and click the first delete button
      const deleteButtons = screen.getAllByRole('button').filter(
        btn => btn.querySelector('svg[data-testid="DeleteIcon"]')
      );
      fireEvent.click(deleteButtons[0]);

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        links: [{ label: 'GitHub', url: 'https://github.com' }],
      });
    });

    it('shows URL placeholder text', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={{ links: [{ label: '', url: '' }] }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const urlInput = screen.getByLabelText('URL');
      expect(urlInput).toHaveAttribute('placeholder', 'https://...');
    });

    it('displays card title in edit mode when provided', () => {
      const onSettingsChange = vi.fn();
      const definitionWithTitle: CardDefinition = {
        ...defaultDefinition,
        title: 'Edit Mode Title',
      };

      render(
        <LinkCard
          definition={definitionWithTitle}
          settings={defaultSettings}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('Edit Mode Title')).toBeInTheDocument();
    });

    it('renders in view mode when editMode true but no onSettingsChange', () => {
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={defaultSettings}
          editMode={true}
          // No onSettingsChange provided
        />
      );

      // Should show links as buttons, not edit controls
      expect(screen.getByRole('link', { name: /Google/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Add Link/i })).not.toBeInTheDocument();
    });
  });

  describe('default values', () => {
    it('handles undefined settings gracefully', () => {
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={undefined as unknown as LinkCardSettings}
          editMode={false}
        />
      );

      expect(screen.getByText('No links configured')).toBeInTheDocument();
    });

    it('defaults variant to buttons', () => {
      const onSettingsChange = vi.fn();
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={{ links: defaultSettings.links }}
          editMode={true}
          onSettingsChange={onSettingsChange}
        />
      );

      const buttonsToggle = screen.getByRole('button', { name: 'Buttons' });
      expect(buttonsToggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('defaults editMode to false', () => {
      render(
        <LinkCard
          definition={defaultDefinition}
          settings={defaultSettings}
        />
      );

      // Should be in view mode (showing link buttons, not edit controls)
      expect(screen.getByRole('link', { name: /Google/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Add Link/i })).not.toBeInTheDocument();
    });
  });
});
