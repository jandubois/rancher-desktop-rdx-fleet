/**
 * EditModeLoadTab - Load configuration from image or ZIP file.
 */

import { RefObject } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadIcon from '@mui/icons-material/Upload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { FleetExtensionImage } from '../utils/extensionBuilder';

export interface EditModeLoadTabProps {
  /** Available Fleet extension images */
  fleetImages: FleetExtensionImage[];
  /** Currently selected image */
  selectedImage: string;
  /** Whether images are being loaded */
  loadingImages: boolean;
  /** Whether an import is in progress */
  importing: boolean;
  /** Ref to the file input element (for resetting after upload) */
  fileInputRef: RefObject<HTMLInputElement>;
  /** Callback when selected image changes */
  onSelectedImageChange: (image: string) => void;
  /** Callback to refresh image list */
  onRefreshImages: () => void;
  /** Callback to load from selected image */
  onLoadFromImage: () => void;
  /** Callback when a file is selected for upload */
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Function to get display name for an image */
  getImageDisplayName: (img: FleetExtensionImage) => string;
}

export function EditModeLoadTab({
  fleetImages,
  selectedImage,
  loadingImages,
  importing,
  fileInputRef,
  onSelectedImageChange,
  onRefreshImages,
  onLoadFromImage,
  onFileUpload,
  getImageDisplayName,
}: EditModeLoadTabProps) {
  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Load an existing configuration from a custom extension image or a ZIP file.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', mb: 2 }}>
        {/* Image selector */}
        <FormControl size="small" sx={{ minWidth: 250, flex: 1 }}>
          <InputLabel>Custom Extension Image</InputLabel>
          <Select
            value={selectedImage}
            onChange={(e) => onSelectedImageChange(e.target.value)}
            label="Custom Extension Image"
            disabled={loadingImages || importing}
          >
            <MenuItem value="">
              <em>Select an image...</em>
            </MenuItem>
            {fleetImages.map((img) => (
              <MenuItem key={`${img.repository}:${img.tag}`} value={`${img.repository}:${img.tag}`}>
                {getImageDisplayName(img)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          size="small"
          onClick={onRefreshImages}
          disabled={loadingImages}
          sx={{ minWidth: 40, px: 1 }}
          title="Refresh image list"
        >
          {loadingImages ? <CircularProgress size={20} /> : <RefreshIcon />}
        </Button>

        <Button
          variant="contained"
          startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
          onClick={onLoadFromImage}
          disabled={!selectedImage || importing}
        >
          Load
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          Or upload a ZIP file:
        </Typography>
        <input
          type="file"
          accept=".zip"
          ref={fileInputRef}
          onChange={onFileUpload}
          style={{ display: 'none' }}
        />
        <Button
          variant="outlined"
          startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <FolderOpenIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          Browse...
        </Button>
      </Box>
    </>
  );
}

export default EditModeLoadTab;
