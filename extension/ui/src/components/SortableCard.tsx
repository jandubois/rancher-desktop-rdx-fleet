import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableCardProps {
  id: string;
  editMode: boolean;
  children: ReactNode;
}

export function SortableCard({ id, editMode, children }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style}>
      {editMode && (
        <Box
          {...attributes}
          {...listeners}
          sx={{
            display: 'flex',
            justifyContent: 'center',
            cursor: 'grab',
            py: 0.5,
            mb: -1,
            '&:hover': { bgcolor: 'action.hover' },
            borderRadius: '4px 4px 0 0',
          }}
        >
          <DragIndicatorIcon fontSize="small" color="action" />
        </Box>
      )}
      {children}
    </Box>
  );
}
