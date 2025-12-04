import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
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

  const dividerStyles: DividerStyle[] = ['solid', 'dashed', 'dotted'];

  const getDividerSx = (styleValue: DividerStyle) => ({
    borderStyle: styleValue,
    borderColor: borderColor,
    '&::before, &::after': {
      borderStyle: styleValue,
      borderColor: borderColor,
    },
  });

  const renderDividerOption = (styleValue: DividerStyle) => (
    <Box sx={{ width: '100%', py: 0.5 }}>
      {label ? (
        <Divider sx={getDividerSx(styleValue)}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Divider>
      ) : (
        <Divider sx={getDividerSx(styleValue)} />
      )}
    </Box>
  );

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

        <Select
          value={style}
          onChange={handleStyleChange}
          size="small"
          fullWidth
          renderValue={(selected) => renderDividerOption(selected)}
          sx={{
            '& .MuiSelect-select': {
              py: 1,
            },
          }}
        >
          {dividerStyles.map((dividerStyle) => (
            <MenuItem key={dividerStyle} value={dividerStyle} sx={{ py: 1 }}>
              {renderDividerOption(dividerStyle)}
            </MenuItem>
          ))}
        </Select>
      </Box>
    );
  }

  // View mode - just render the divider
  return (
    <Box sx={{ py: 1 }}>
      {label ? (
        <Divider sx={getDividerSx(style)}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Divider>
      ) : (
        <Divider sx={getDividerSx(style)} />
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
