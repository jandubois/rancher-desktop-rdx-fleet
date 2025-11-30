import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { CardWrapperProps } from './types';

export const CardWrapper: React.FC<CardWrapperProps> = ({
  definition,
  editMode = false,
  onDelete,
  onVisibilityToggle,
  paletteColors,
  children,
}) => {
  const isVisible = definition.visible !== false;
  const isEnabled = definition.enabled !== false;

  // In edit mode, show card even if not visible (but with reduced opacity)
  if (!isVisible && !editMode) {
    return null;
  }

  return (
    <Paper
      sx={{
        p: 2,
        mb: 2,
        border: '1px solid',
        borderColor: paletteColors?.border ?? 'grey.300',
        boxShadow: 2,
        opacity: isVisible ? 1 : 0.5,
        position: 'relative',
        ...(isEnabled ? {} : { pointerEvents: 'none', opacity: 0.7 }),
      }}
    >
      {/* Edit mode header - compact controls only */}
      {editMode && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 1,
            pb: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <IconButton size="small" sx={{ cursor: 'grab' }} title="Drag to reorder">
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
            {definition.type}
          </Typography>
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

      {/* Card content - apply title color if specified */}
      <Box sx={{ color: paletteColors?.title ?? 'inherit' }}>
        {children}
      </Box>
    </Paper>
  );
};

export default CardWrapper;
