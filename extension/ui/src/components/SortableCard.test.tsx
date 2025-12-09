/**
 * Tests for SortableCard component
 *
 * SortableCard is the drag-and-drop wrapper for cards in edit mode:
 * - Provides drag-and-drop functionality via @dnd-kit/sortable
 * - Shows drag handle in edit mode, hidden in view mode
 * - Shows visibility toggle button when onVisibilityToggle is provided
 * - Shows delete button when onDelete is provided
 * - Applies reduced opacity while dragging
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SortableCard } from './SortableCard';

// Control isDragging state per-test
let mockIsDragging = false;

// Mock @dnd-kit/sortable with controllable isDragging
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: { role: 'button' },
    listeners: { onMouseDown: vi.fn() },
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    get isDragging() {
      return mockIsDragging;
    },
  }),
}));

beforeEach(() => {
  mockIsDragging = false;
});

// Mock @dnd-kit/utilities
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

describe('SortableCard', () => {
  it('renders children', () => {
    render(
      <SortableCard id="test-id" editMode={false}>
        <div data-testid="child-content">Hello World</div>
      </SortableCard>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('shows drag handle in edit mode', () => {
    render(
      <SortableCard id="test-id" editMode={true}>
        <div>Content</div>
      </SortableCard>
    );

    // DragIndicatorIcon should be present
    expect(screen.getByTestId('DragIndicatorIcon')).toBeInTheDocument();
  });

  it('hides drag handle when not in edit mode', () => {
    render(
      <SortableCard id="test-id" editMode={false}>
        <div>Content</div>
      </SortableCard>
    );

    // DragIndicatorIcon should not be present
    expect(screen.queryByTestId('DragIndicatorIcon')).not.toBeInTheDocument();
  });

  it('renders multiple children', () => {
    render(
      <SortableCard id="test-id" editMode={false}>
        <div>First</div>
        <div>Second</div>
      </SortableCard>
    );

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('applies reduced opacity when dragging', () => {
    mockIsDragging = true;

    render(
      <SortableCard id="test-id" editMode={true}>
        <div>Content</div>
      </SortableCard>
    );

    const card = screen.getByTestId('card-test-id');
    expect(card).toHaveStyle({ opacity: 0.5 });
  });

  it('applies full opacity when not dragging', () => {
    mockIsDragging = false;

    render(
      <SortableCard id="drag-test" editMode={true}>
        <div>Content</div>
      </SortableCard>
    );

    const card = screen.getByTestId('card-drag-test');
    expect(card).toHaveStyle({ opacity: 1 });
  });

  describe('visibility toggle', () => {
    it('shows visibility toggle when onVisibilityToggle provided', () => {
      const onVisibilityToggle = vi.fn();
      render(
        <SortableCard
          id="test-id"
          editMode={true}
          isVisible={true}
          onVisibilityToggle={onVisibilityToggle}
        >
          <div>Content</div>
        </SortableCard>
      );

      expect(screen.getByTitle('Hide card')).toBeInTheDocument();
    });

    it('does not show visibility toggle when onVisibilityToggle not provided', () => {
      render(
        <SortableCard id="test-id" editMode={true}>
          <div>Content</div>
        </SortableCard>
      );

      expect(screen.queryByTitle('Hide card')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Show card')).not.toBeInTheDocument();
    });

    it('shows "Show card" title when card is hidden', () => {
      const onVisibilityToggle = vi.fn();
      render(
        <SortableCard
          id="test-id"
          editMode={true}
          isVisible={false}
          onVisibilityToggle={onVisibilityToggle}
        >
          <div>Content</div>
        </SortableCard>
      );

      expect(screen.getByTitle('Show card')).toBeInTheDocument();
    });

    it('calls onVisibilityToggle when visibility button clicked', () => {
      const onVisibilityToggle = vi.fn();
      render(
        <SortableCard
          id="test-id"
          editMode={true}
          isVisible={true}
          onVisibilityToggle={onVisibilityToggle}
        >
          <div>Content</div>
        </SortableCard>
      );

      fireEvent.click(screen.getByTitle('Hide card'));
      expect(onVisibilityToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete button', () => {
    it('shows delete button when onDelete provided', () => {
      const onDelete = vi.fn();
      render(
        <SortableCard id="test-id" editMode={true} onDelete={onDelete}>
          <div>Content</div>
        </SortableCard>
      );

      expect(screen.getByTitle('Delete card')).toBeInTheDocument();
    });

    it('does not show delete button when onDelete not provided', () => {
      render(
        <SortableCard id="test-id" editMode={true}>
          <div>Content</div>
        </SortableCard>
      );

      expect(screen.queryByTitle('Delete card')).not.toBeInTheDocument();
    });

    it('calls onDelete when delete button clicked', () => {
      const onDelete = vi.fn();
      render(
        <SortableCard id="test-id" editMode={true} onDelete={onDelete}>
          <div>Content</div>
        </SortableCard>
      );

      fireEvent.click(screen.getByTitle('Delete card'));
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('edit controls visibility', () => {
    it('hides all edit controls when not in edit mode', () => {
      const onDelete = vi.fn();
      const onVisibilityToggle = vi.fn();
      render(
        <SortableCard
          id="test-id"
          editMode={false}
          isVisible={true}
          onDelete={onDelete}
          onVisibilityToggle={onVisibilityToggle}
        >
          <div>Content</div>
        </SortableCard>
      );

      expect(screen.queryByTestId('DragIndicatorIcon')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Hide card')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Delete card')).not.toBeInTheDocument();
    });
  });
});
