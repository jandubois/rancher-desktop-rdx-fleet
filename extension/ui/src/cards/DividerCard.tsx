import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { CardProps } from './types';
import { DividerCardSettings } from '../manifest/types';
import { registerCard } from './registry';

type DividerStyle = 'solid' | 'dashed' | 'dotted';

export const DividerCard: React.FC<CardProps<DividerCardSettings>> = ({
  settings,
  editMode = false,
  onSettingsChange,
  paletteColors,
}) => {
  const label = settings?.label || '';
  const style: DividerStyle = settings?.style || 'solid';
  const borderColor = paletteColors?.border ?? 'grey.300';

  const handleStyleChange = (event: SelectChangeEvent<DividerStyle>) => {
    if (onSettingsChange) {
      onSettingsChange({
        ...settings,
        style: event.target.value as DividerStyle,
      });
    }
  };

  const dividerStyles: { value: DividerStyle; label: string }[] = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
  ];

  const renderStylePreview = (styleValue: DividerStyle) => (
    <Box
      sx={{
        width: 60,
        height: 0,
        borderTopWidth: 2,
        borderTopStyle: styleValue,
        borderTopColor: borderColor,
      }}
    />
  );

  const dividerSx = {
    borderStyle: style,
    borderColor: borderColor,
    '&::before, &::after': {
      borderStyle: style,
      borderColor: borderColor,
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
          <Select
            value={style}
            onChange={handleStyleChange}
            size="small"
            fullWidth
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {renderStylePreview(selected)}
                <Typography variant="body2">
                  {dividerStyles.find((s) => s.value === selected)?.label}
                </Typography>
              </Box>
            )}
          >
            {dividerStyles.map((dividerStyle) => (
              <MenuItem key={dividerStyle.value} value={dividerStyle.value}>
                <ListItemIcon sx={{ minWidth: 80 }}>
                  {renderStylePreview(dividerStyle.value)}
                </ListItemIcon>
                <ListItemText primary={dividerStyle.label} />
              </MenuItem>
            ))}
          </Select>
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
registerCard('divider', DividerCard, {
  label: 'Divider',
  orderable: true,
  category: 'content',
  defaultSettings: () => ({ label: '', style: 'solid' }),
});

export default DividerCard;
