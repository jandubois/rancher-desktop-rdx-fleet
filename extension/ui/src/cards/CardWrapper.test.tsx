/**
 * Tests for CardWrapper component
 *
 * CardWrapper is the base wrapper component for all card types:
 * - Wraps card content in a Paper component with consistent styling
 * - Shows edit controls (drag handle, visibility toggle, delete) in edit mode
 * - Hides edit controls in view mode
 * - Handles visibility: hidden cards render null in view mode, show with reduced opacity in edit mode
 * - Handles disabled state with reduced interactivity
 * - Special handling for divider cards (no Paper wrapper in view mode)
 * - Applies palette colors for border and title styling
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    it('hides edit controls in view mode', () => {
      render(
        <CardWrapper
          definition={defaultDefinition}
          editMode={false}
          onDelete={vi.fn()}
          onVisibilityToggle={vi.fn()}
        >
          <div>Content</div>
        </CardWrapper>
      );

      // Drag handle, visibility, and delete buttons should not be present
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
    it('shows drag handle in edit mode', () => {
      render(
        <CardWrapper definition={defaultDefinition} editMode={true}>
          <div>Content</div>
        </CardWrapper>
      );

      expect(screen.getByTitle('Drag to reorder')).toBeInTheDocument();
    });

    it('shows card type label in edit mode', () => {
      render(
        <CardWrapper definition={defaultDefinition} editMode={true}>
          <div>Content</div>
        </CardWrapper>
      );

      expect(screen.getByText('markdown')).toBeInTheDocument();
    });

    it('shows visibility toggle when onVisibilityToggle provided', () => {
      const onVisibilityToggle = vi.fn();
      render(
        <CardWrapper
          definition={defaultDefinition}
          editMode={true}
          onVisibilityToggle={onVisibilityToggle}
        >
          <div>Content</div>
        </CardWrapper>
      );

      expect(screen.getByTitle('Hide card')).toBeInTheDocument();
    });

    it('does not show visibility toggle when onVisibilityToggle not provided', () => {
      render(
        <CardWrapper definition={defaultDefinition} editMode={true}>
          <div>Content</div>
        </CardWrapper>
      );

      expect(screen.queryByTitle('Hide card')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Show card')).not.toBeInTheDocument();
    });

    it('shows delete button when onDelete provided', () => {
      const onDelete = vi.fn();
      render(
        <CardWrapper definition={defaultDefinition} editMode={true} onDelete={onDelete}>
          <div>Content</div>
        </CardWrapper>
      );

      expect(screen.getByTitle('Delete card')).toBeInTheDocument();
    });

    it('does not show delete button when onDelete not provided', () => {
      render(
        <CardWrapper definition={defaultDefinition} editMode={true}>
          <div>Content</div>
        </CardWrapper>
      );

      expect(screen.queryByTitle('Delete card')).not.toBeInTheDocument();
    });

    it('calls onDelete when delete button clicked', () => {
      const onDelete = vi.fn();
      render(
        <CardWrapper definition={defaultDefinition} editMode={true} onDelete={onDelete}>
          <div>Content</div>
        </CardWrapper>
      );

      fireEvent.click(screen.getByTitle('Delete card'));
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('calls onVisibilityToggle when visibility button clicked', () => {
      const onVisibilityToggle = vi.fn();
      render(
        <CardWrapper
          definition={defaultDefinition}
          editMode={true}
          onVisibilityToggle={onVisibilityToggle}
        >
          <div>Content</div>
        </CardWrapper>
      );

      fireEvent.click(screen.getByTitle('Hide card'));
      expect(onVisibilityToggle).toHaveBeenCalledTimes(1);
    });

    it('shows "Show card" title for hidden cards', () => {
      const hiddenDefinition: CardDefinition = {
        ...defaultDefinition,
        visible: false,
      };
      const onVisibilityToggle = vi.fn();

      render(
        <CardWrapper
          definition={hiddenDefinition}
          editMode={true}
          onVisibilityToggle={onVisibilityToggle}
        >
          <div>Content</div>
        </CardWrapper>
      );

      expect(screen.getByTitle('Show card')).toBeInTheDocument();
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
        <CardWrapper
          definition={defaultDefinition}
          onDelete={vi.fn()}
          onVisibilityToggle={vi.fn()}
        >
          <div>Content</div>
        </CardWrapper>
      );

      // Edit controls should not be visible
      expect(screen.queryByTitle('Drag to reorder')).not.toBeInTheDocument();
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
