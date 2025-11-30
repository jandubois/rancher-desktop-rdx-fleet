import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';

const MAX_LENGTH_WARNING = 20;

interface EditableTitleProps {
  value: string;
  editMode?: boolean;
  onChange?: (value: string) => void;
  placeholder?: string;
  variant?: 'h6' | 'subtitle1' | 'subtitle2';
  children?: React.ReactNode; // Additional content to show after the title
}

/**
 * An inline-editable title component.
 * Shows an InputBase when in edit mode, Typography otherwise.
 */
export const EditableTitle: React.FC<EditableTitleProps> = ({
  value,
  editMode = false,
  onChange,
  placeholder = 'Enter title...',
  variant = 'h6',
  children,
}) => {
  if (editMode && onChange) {
    const isTooLong = value.length > MAX_LENGTH_WARNING;

    return (
      <Box sx={{ flex: 1 }}>
        <InputBase
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          fullWidth
          sx={{
            typography: variant,
            fontWeight: variant === 'h6' ? 500 : undefined,
            '& .MuiInputBase-input': {
              p: 0,
              '&::placeholder': {
                opacity: 0.5,
              },
            },
          }}
        />
        {isTooLong && (
          <Typography variant="caption" color="warning.main">
            Long names may wrap in the sidebar ({value.length} characters)
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Typography variant={variant}>
      {value}
      {children}
    </Typography>
  );
};

export default EditableTitle;
