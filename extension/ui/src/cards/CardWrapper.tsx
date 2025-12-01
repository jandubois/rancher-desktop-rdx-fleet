import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { CardWrapperProps } from './types';

export const CardWrapper: React.FC<CardWrapperProps> = ({
  definition,
  editMode = false,
  paletteColors,
  children,
}) => {
  const isVisible = definition.visible !== false;
  const isEnabled = definition.enabled !== false;
  const isDivider = definition.type === 'divider';

  // In edit mode, show card even if not visible (but with reduced opacity)
  if (!isVisible && !editMode) {
    return null;
  }

  // Divider cards in view mode: render without card wrapper, just the divider line
  if (isDivider && !editMode) {
    return (
      <Box sx={{ mb: 2, opacity: isVisible ? 1 : 0.5, ...(isEnabled ? {} : { pointerEvents: 'none', opacity: 0.7 }) }}>
        {children}
      </Box>
    );
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
      {/* Card content - apply title color if specified */}
      <Box sx={{ color: paletteColors?.title ?? 'inherit' }}>
        {children}
      </Box>
    </Paper>
  );
};

export default CardWrapper;
