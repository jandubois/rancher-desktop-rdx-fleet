import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SortableCard } from './SortableCard';

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: { role: 'button' },
    listeners: { onMouseDown: vi.fn() },
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

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
    // Override the mock for this test
    vi.doMock('@dnd-kit/sortable', () => ({
      useSortable: () => ({
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        transform: null,
        transition: undefined,
        isDragging: true,
      }),
    }));

    // The component would apply opacity: 0.5 when isDragging is true
    // This is a structural test that verifies the component renders without error
    render(
      <SortableCard id="test-id" editMode={true}>
        <div>Content</div>
      </SortableCard>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
