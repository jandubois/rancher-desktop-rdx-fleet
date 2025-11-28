import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { CardProps } from './types';
import { DividerCardSettings } from '../manifest/types';
import { registerCard } from './registry';

type DividerStyle = 'solid' | 'dashed' | 'dotted';

export const DividerCard: React.FC<CardProps<DividerCardSettings>> = ({
  settings,
  editMode = false,
  onSettingsChange,
}) => {
  const label = settings?.label || '';
  const style: DividerStyle = settings?.style || 'solid';

  const handleStyleChange = (_: React.MouseEvent<HTMLElement>, newStyle: DividerStyle) => {
    if (newStyle && onSettingsChange) {
      onSettingsChange({
        ...settings,
        style: newStyle,
      });
    }
  };

  const dividerSx = {
    borderStyle: style,
    '&::before, &::after': {
      borderStyle: style,
    },
  };

  if (editMode && onSettingsChange) {
    return (
      <Box>
        <TextField
          fullWidth
          label="Label (optional)"
          value={label}
          onChange={(e) => onSettingsChange({ ...settings, label: e.target.value })}
          placeholder="Section title..."
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
        />

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Line Style:
          </Typography>
          <ToggleButtonGroup
            value={style}
            exclusive
            onChange={handleStyleChange}
            size="small"
          >
            <ToggleButton value="solid">Solid</ToggleButton>
            <ToggleButton value="dashed">Dashed</ToggleButton>
            <ToggleButton value="dotted">Dotted</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Preview:
          </Typography>
          {label ? (
            <Divider sx={dividerSx}>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
            </Divider>
          ) : (
            <Divider sx={dividerSx} />
          )}
        </Box>
      </Box>
    );
  }

  // View mode - just render the divider
  return (
    <Box sx={{ py: 1 }}>
      {label ? (
        <Divider sx={dividerSx}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Divider>
      ) : (
        <Divider sx={dividerSx} />
      )}
    </Box>
  );
};

// Register the divider card
registerCard('divider', DividerCard);

export default DividerCard;
