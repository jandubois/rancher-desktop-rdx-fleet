import React from 'react';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';

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
    return (
      <InputBase
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
