import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import { CardProps } from './types';
import { ImageCardSettings } from '../manifest/types';
import { registerCard } from './registry';

export const ImageCard: React.FC<CardProps<ImageCardSettings>> = ({
  definition,
  settings,
  editMode = false,
  onSettingsChange,
}) => {
  const src = settings?.src || '';
  const alt = settings?.alt || '';

  if (editMode && onSettingsChange) {
    return (
      <Box>
        {definition.title && (
          <Typography variant="h6" gutterBottom>
            {definition.title}
          </Typography>
        )}
        <TextField
          fullWidth
          label="Image URL"
          value={src}
          onChange={(e) => onSettingsChange({ ...settings, src: e.target.value })}
          placeholder="https://example.com/image.png"
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label="Alt Text"
          value={alt}
          onChange={(e) => onSettingsChange({ ...settings, alt: e.target.value })}
          placeholder="Description of the image"
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
        />
        {src && (
          <Box sx={{ mt: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Preview:
            </Typography>
            <Box
              component="img"
              src={src}
              alt={alt}
              sx={{
                maxWidth: '100%',
                maxHeight: 300,
                objectFit: 'contain',
                borderRadius: 1,
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </Box>
        )}
      </Box>
    );
  }

  if (!src) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">No image configured</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {definition.title && (
        <Typography variant="h6" gutterBottom>
          {definition.title}
        </Typography>
      )}
      <Box
        component="img"
        src={src}
        alt={alt}
        sx={{
          maxWidth: '100%',
          maxHeight: 400,
          objectFit: 'contain',
          borderRadius: 1,
          display: 'block',
        }}
      />
    </Box>
  );
};

// Register the image card
registerCard('image', ImageCard);

export default ImageCard;
