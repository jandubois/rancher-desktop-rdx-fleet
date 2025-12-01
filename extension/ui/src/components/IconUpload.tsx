/**
 * IconUpload component - Upload area for extension icon.
 *
 * Refactored to use the shared useFileUpload hook.
 */

import { useState, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import { useFileUpload, DEFAULT_ACCEPTED_TYPES, DEFAULT_MAX_SIZE } from '../hooks/useFileUpload';

export interface CustomIcon {
  data: string;  // Base64 encoded image data
  filename: string;  // Original filename
  mimeType: string;  // MIME type (e.g., image/png, image/svg+xml)
}

interface IconUploadProps {
  value: CustomIcon | null;
  onChange: (icon: CustomIcon | null) => void;
  defaultIconPath?: string;  // Path to show when no custom icon is set
}

export function IconUpload({ value, onChange, defaultIconPath }: IconUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use the shared file upload hook
  const { error, validateAndProcessFile, clearError } = useFileUpload({
    acceptedTypes: DEFAULT_ACCEPTED_TYPES,
    maxSize: DEFAULT_MAX_SIZE,
  });

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const result = await validateAndProcessFile(files[0]);
      if (result) {
        onChange(result as CustomIcon);
      }
    }
  }, [onChange, validateAndProcessFile]);

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
    const files = e.target.files;
    if (files && files.length > 0) {
      const result = await validateAndProcessFile(files[0]);
      if (result) {
        onChange(result as CustomIcon);
      }
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onChange, validateAndProcessFile]);

  const handleDelete = useCallback(() => {
    onChange(null);
    clearError();
  }, [onChange, clearError]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Get the preview URL
  const previewUrl = value
    ? `data:${value.mimeType};base64,${value.data}`
    : defaultIconPath || null;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        Extension Icon
      </Typography>

      <Paper
        sx={{
          border: '2px dashed',
          borderColor: isDragging ? 'primary.main' : error ? 'error.main' : 'grey.400',
          bgcolor: isDragging ? 'action.hover' : 'background.paper',
          borderRadius: 2,
          p: 2,
          transition: 'all 0.2s ease',
          cursor: 'pointer',
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
          {previewUrl ? (
            <Box
              sx={{
                width: 64,
                height: 64,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'grey.100',
                overflow: 'hidden',
              }}
            >
              <img
                src={previewUrl}
                alt="Extension icon"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            </Box>
          ) : (
            <ImageIcon sx={{ fontSize: 48, color: 'grey.400' }} />
          )}

          {/* Upload instructions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CloudUploadIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {isDragging ? 'Drop image here' : 'Drop or click to upload'}
            </Typography>
          </Box>

          <Typography variant="caption" color="text.secondary">
            PNG, SVG, JPEG, GIF, WebP (max 512KB)
          </Typography>

          {/* Show filename if custom icon is set */}
          {value && (
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500 }}>
              {value.filename}
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
        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
          {error}
        </Typography>
      )}

      {/* Delete button */}
      {value && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Button
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
          >
            Remove custom icon
          </Button>
        </Box>
      )}
    </Box>
  );
}
