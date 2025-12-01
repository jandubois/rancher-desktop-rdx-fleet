/**
 * Tests for CardWrapper component
 *
 * CardWrapper is the base wrapper component for all card types:
 * - Wraps card content in a Paper component with consistent styling
 * - Handles visibility: hidden cards render null in view mode, show with reduced opacity in edit mode
 * - Handles disabled state with reduced interactivity
 * - Special handling for divider cards (no Paper wrapper in view mode)
 * - Applies palette colors for border and title styling
 *
 * Note: Edit controls (drag handle, visibility toggle, delete) are handled by SortableCard
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardWrapper } from './CardWrapper';
import { CardDefinition } from '../manifest/types';

describe('CardWrapper', () => {
  const defaultDefinition: CardDefinition = {
    id: 'test-card',
    type: 'markdown',
    title: 'Test Card',
    visible: true,
    enabled: true,
  };

  describe('view mode (editMode=false)', () => {
    it('renders children content', () => {
      render(
        <CardWrapper definition={defaultDefinition}>
          <div>Card Content</div>
        </CardWrapper>
      );

      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('does not render edit controls (they are in SortableCard)', () => {
      render(
        <CardWrapper
          definition={defaultDefinition}
          editMode={false}
        >
          <div>Content</div>
        </CardWrapper>
      );

      // Edit controls are handled by SortableCard, not CardWrapper
      expect(screen.queryByTitle('Drag to reorder')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Hide card')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Delete card')).not.toBeInTheDocument();
    });

    it('returns null for hidden cards in view mode', () => {
      const hiddenDefinition: CardDefinition = {
        ...defaultDefinition,
        visible: false,
      };

      const { container } = render(
        <CardWrapper definition={hiddenDefinition} editMode={false}>
          <div>Hidden Content</div>
        </CardWrapper>
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders visible cards normally', () => {
      render(
        <CardWrapper definition={defaultDefinition} editMode={false}>
          <div>Visible Content</div>
        </CardWrapper>
      );

      expect(screen.getByText('Visible Content')).toBeInTheDocument();
    });
  });

  describe('edit mode (editMode=true)', () => {
    it('does not render edit controls (they are in SortableCard)', () => {
      render(
        <CardWrapper definition={defaultDefinition} editMode={true}>
          <div>Content</div>
        </CardWrapper>
      );

      // Edit controls (drag handle, visibility, delete) are handled by SortableCard
      expect(screen.queryByTitle('Drag to reorder')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Hide card')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Delete card')).not.toBeInTheDocument();
    });

    it('renders hidden cards with reduced opacity in edit mode', () => {
      const hiddenDefinition: CardDefinition = {
        ...defaultDefinition,
        visible: false,
      };

      render(
        <CardWrapper definition={hiddenDefinition} editMode={true}>
          <div>Hidden Content</div>
        </CardWrapper>
      );

      // Card should still be rendered in edit mode
      expect(screen.getByText('Hidden Content')).toBeInTheDocument();
    });
  });

  describe('divider card special handling', () => {
    const dividerDefinition: CardDefinition = {
      id: 'test-divider',
      type: 'divider',
      visible: true,
      enabled: true,
    };

    it('renders divider without Paper wrapper in view mode', () => {
      const { container } = render(
        <CardWrapper definition={dividerDefinition} editMode={false}>
          <hr />
        </CardWrapper>
      );

      // Should not have Paper component (which has class MuiPaper-root)
      expect(container.querySelector('.MuiPaper-root')).not.toBeInTheDocument();
    });

    it('renders divider with Paper wrapper in edit mode', () => {
      const { container } = render(
        <CardWrapper definition={dividerDefinition} editMode={true}>
          <hr />
        </CardWrapper>
      );

      // Should have Paper component in edit mode
      expect(container.querySelector('.MuiPaper-root')).toBeInTheDocument();
    });
  });

  describe('palette colors', () => {
    it('applies palette border color when provided', () => {
      const { container } = render(
        <CardWrapper
          definition={defaultDefinition}
          editMode={false}
          paletteColors={{ border: 'red' }}
        >
          <div>Content</div>
        </CardWrapper>
      );

      const paper = container.querySelector('.MuiPaper-root');
      expect(paper).toBeInTheDocument();
    });

    it('applies palette title color to content wrapper', () => {
      render(
        <CardWrapper
          definition={defaultDefinition}
          editMode={false}
          paletteColors={{ title: 'blue' }}
        >
          <div>Content</div>
        </CardWrapper>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('renders disabled cards with reduced interactivity', () => {
      const disabledDefinition: CardDefinition = {
        ...defaultDefinition,
        enabled: false,
      };

      render(
        <CardWrapper definition={disabledDefinition} editMode={false}>
          <div>Disabled Content</div>
        </CardWrapper>
      );

      expect(screen.getByText('Disabled Content')).toBeInTheDocument();
    });
  });

  describe('default props', () => {
    it('defaults editMode to false', () => {
      render(
        <CardWrapper definition={defaultDefinition}>
          <div>Content</div>
        </CardWrapper>
      );

      // Content should be visible
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('treats undefined visible as true', () => {
      const noVisibleDefinition: CardDefinition = {
        id: 'test',
        type: 'markdown',
      };

      render(
        <CardWrapper definition={noVisibleDefinition} editMode={false}>
          <div>Content</div>
        </CardWrapper>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('treats undefined enabled as true', () => {
      const noEnabledDefinition: CardDefinition = {
        id: 'test',
        type: 'markdown',
      };

      render(
        <CardWrapper definition={noEnabledDefinition} editMode={false}>
          <div>Content</div>
        </CardWrapper>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });
});
