import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableCardProps {
  id: string;
  editMode: boolean;
  isVisible?: boolean;
  onDelete?: () => void;
  onVisibilityToggle?: () => void;
  children: ReactNode;
}

export function SortableCard({ id, editMode, isVisible = true, onDelete, onVisibilityToggle, children }: SortableCardProps) {
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
    <Box ref={setNodeRef} style={style} data-testid={`card-${id}`}>
      {editMode && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            py: 0.5,
            mb: -1,
            borderRadius: '4px 4px 0 0',
          }}
        >
          <Box
            {...attributes}
            {...listeners}
            data-testid={`drag-handle-${id}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'grab',
              px: 1,
              py: 0.25,
              '&:hover': { bgcolor: 'action.hover' },
              borderRadius: 1,
            }}
          >
            <DragIndicatorIcon fontSize="small" color="action" />
          </Box>
          {onVisibilityToggle && (
            <IconButton size="small" onClick={onVisibilityToggle} title={isVisible ? 'Hide card' : 'Show card'}>
              {isVisible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
            </IconButton>
          )}
          {onDelete && (
            <IconButton size="small" onClick={onDelete} title="Delete card" color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}
      {children}
    </Box>
  );
}
