import React, { useState, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LinkIcon from '@mui/icons-material/Link';
import DeleteIcon from '@mui/icons-material/Delete';
import { CardProps } from './types';
import { ImageCardSettings, BundledImage } from '../manifest/types';
import { registerCard } from './registry';
import { useFileUpload, DEFAULT_ACCEPTED_TYPES } from '../hooks/useFileUpload';

// Larger max size for card images (2MB)
const IMAGE_MAX_SIZE = 2 * 1024 * 1024;

type ImageSourceMode = 'upload' | 'url';

export const ImageCard: React.FC<CardProps<ImageCardSettings>> = ({
  definition,
  settings,
  editMode = false,
  onSettingsChange,
}) => {
  const src = settings?.src || '';
  const alt = settings?.alt || '';
  const bundledImage = settings?.bundledImage;

  // Determine initial mode - default to upload unless there's an external URL
  const [sourceMode, setSourceMode] = useState<ImageSourceMode>(
    src && !bundledImage && !src.startsWith('/images/') ? 'url' : 'upload'
  );
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use the shared file upload hook with larger size limit
  const { error, validateAndProcessFile, clearError } = useFileUpload({
    acceptedTypes: DEFAULT_ACCEPTED_TYPES,
    maxSize: IMAGE_MAX_SIZE,
  });

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!onSettingsChange) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const result = await validateAndProcessFile(files[0]);
      if (result) {
        const newBundledImage: BundledImage = {
          data: result.data,
          filename: result.filename,
          mimeType: result.mimeType,
        };
        // Set src to a placeholder path that will be resolved during bundling
        onSettingsChange({
          ...settings,
          src: `/images/${result.filename}`,
          bundledImage: newBundledImage,
        });
      }
    }
  }, [onSettingsChange, settings, validateAndProcessFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSettingsChange) return;

    const files = e.target.files;
    if (files && files.length > 0) {
      const result = await validateAndProcessFile(files[0]);
      if (result) {
        const newBundledImage: BundledImage = {
          data: result.data,
          filename: result.filename,
          mimeType: result.mimeType,
        };
        onSettingsChange({
          ...settings,
          src: `/images/${result.filename}`,
          bundledImage: newBundledImage,
        });
      }
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onSettingsChange, settings, validateAndProcessFile]);

  const handleDeleteImage = useCallback(() => {
    if (!onSettingsChange) return;
    onSettingsChange({
      ...settings,
      src: '',
      bundledImage: undefined,
    });
    clearError();
  }, [onSettingsChange, settings, clearError]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleModeChange = useCallback((_: React.MouseEvent<HTMLElement>, newMode: ImageSourceMode | null) => {
    if (newMode && onSettingsChange) {
      setSourceMode(newMode);
      // Clear bundled image when switching to URL mode
      if (newMode === 'url' && bundledImage) {
        onSettingsChange({
          ...settings,
          src: '',
          bundledImage: undefined,
        });
      }
    }
  }, [onSettingsChange, settings, bundledImage]);

  // Get the preview URL - prefer bundled image data, then fallback to src
  const getPreviewUrl = (): string | null => {
    if (bundledImage) {
      return `data:${bundledImage.mimeType};base64,${bundledImage.data}`;
    }
    return src || null;
  };

  if (editMode && onSettingsChange) {
    const previewUrl = getPreviewUrl();

    return (
      <Box>
        {definition.title && (
          <Typography variant="h6" gutterBottom>
            {definition.title}
          </Typography>
        )}

        {/* Source mode toggle */}
        <Box sx={{ mb: 2 }}>
          <ToggleButtonGroup
            value={sourceMode}
            exclusive
            onChange={handleModeChange}
            size="small"
            fullWidth
          >
            <ToggleButton value="upload" sx={{ textTransform: 'none' }}>
              <CloudUploadIcon sx={{ mr: 0.5, fontSize: 18 }} />
              Upload Image
            </ToggleButton>
            <ToggleButton value="url" sx={{ textTransform: 'none' }}>
              <LinkIcon sx={{ mr: 0.5, fontSize: 18 }} />
              Image URL
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {sourceMode === 'upload' ? (
          <>
            {/* Upload drop zone */}
            <Paper
              sx={{
                border: '2px dashed',
                borderColor: isDragging ? 'primary.main' : error ? 'error.main' : 'grey.400',
                bgcolor: isDragging ? 'action.hover' : 'background.paper',
                borderRadius: 2,
                p: 2,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                mb: 2,
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleClick}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {/* Preview area */}
                {bundledImage ? (
                  <Box
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 200,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      borderRadius: 1,
                    }}
                  >
                    <img
                      src={previewUrl || ''}
                      alt={alt || 'Uploaded image'}
                      style={{
                        maxWidth: '100%',
                        maxHeight: 200,
                        objectFit: 'contain',
                      }}
                    />
                  </Box>
                ) : (
                  <CloudUploadIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                )}

                {/* Upload instructions */}
                <Typography variant="body2" color="text.secondary">
                  {isDragging ? 'Drop image here' : bundledImage ? 'Drop or click to replace' : 'Drop or click to upload'}
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  PNG, SVG, JPEG, GIF, WebP (max 2MB)
                </Typography>

                {/* Show filename if image is uploaded */}
                {bundledImage && (
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500 }}>
                    {bundledImage.filename}
                  </Typography>
                )}
              </Box>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept={DEFAULT_ACCEPTED_TYPES.join(',')}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                onClick={(e) => e.stopPropagation()}
              />
            </Paper>

            {/* Error message */}
            {error && (
              <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>
                {error}
              </Typography>
            )}

            {/* Delete button */}
            {bundledImage && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteImage();
                  }}
                >
                  Remove image
                </Button>
              </Box>
            )}
          </>
        ) : (
          <>
            {/* URL input */}
            <TextField
              fullWidth
              label="Image URL"
              value={src}
              onChange={(e) => onSettingsChange({ ...settings, src: e.target.value, bundledImage: undefined })}
              placeholder="https://example.com/image.png"
              variant="outlined"
              size="small"
              sx={{ mb: 2 }}
            />

            {/* Preview for URL mode */}
            {src && !bundledImage && (
              <Box sx={{ mt: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Preview:
                </Typography>
                <Box
                  component="img"
                  src={src}
                  alt={alt}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    objectFit: 'contain',
                    borderRadius: 1,
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </Box>
            )}
          </>
        )}

        {/* Alt text field (common to both modes) */}
        <TextField
          fullWidth
          label="Alt Text"
          value={alt}
          onChange={(e) => onSettingsChange({ ...settings, alt: e.target.value })}
          placeholder="Description of the image"
          variant="outlined"
          size="small"
        />
      </Box>
    );
  }

  // Get the display URL - prefer bundled image data, then fallback to src
  const displayUrl = bundledImage
    ? `data:${bundledImage.mimeType};base64,${bundledImage.data}`
    : src;

  if (!displayUrl) {
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
        src={displayUrl}
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
