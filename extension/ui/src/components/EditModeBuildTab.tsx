/**
 * EditModeBuildTab - Build or download extension as Docker image or ZIP.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import DownloadIcon from '@mui/icons-material/Download';
import BuildIcon from '@mui/icons-material/Build';

export interface EditModeBuildTabProps {
  /** Base image for building (auto-detected from current running extension) */
  baseImage: string;
  /** Output image name */
  imageName: string;
  /** Whether download is in progress */
  downloading: boolean;
  /** Whether build is in progress */
  building: boolean;
  /** Build output message */
  buildOutput: string | null;
  /** Build error message */
  buildError: string | null;
  /** Validation warning for image name */
  imageNameWarning?: string | null;
  /** Validation warning for title */
  titleWarning?: string | null;
  /** Callback when image name changes */
  onImageNameChange: (value: string) => void;
  /** Callback to download as ZIP */
  onDownload: () => void;
  /** Callback to build Docker image */
  onBuild: () => void;
}

export function EditModeBuildTab({
  baseImage,
  imageName,
  downloading,
  building,
  buildOutput,
  buildError,
  imageNameWarning,
  titleWarning,
  onImageNameChange,
  onDownload,
  onBuild,
}: EditModeBuildTabProps) {
  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Build or download your custom extension as a Docker image or ZIP file.
      </Typography>

      {/* Output image name input */}
      <TextField
        label="Output Image Name"
        value={imageName}
        onChange={(e) => onImageNameChange(e.target.value)}
        size="small"
        fullWidth
        sx={{ mb: imageNameWarning || titleWarning ? 1 : 2 }}
        helperText="Tag for the built Docker image"
      />

      {/* Image name validation warning */}
      {imageNameWarning && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {imageNameWarning}
        </Alert>
      )}

      {/* Title validation warning (shown in build tab in case title is scrolled out of view) */}
      {titleWarning && !imageNameWarning && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {titleWarning}
        </Alert>
      )}

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          onClick={onDownload}
          disabled={downloading}
        >
          {downloading ? 'Downloading...' : 'Download ZIP'}
        </Button>
        <Button
          variant="outlined"
          color="primary"
          startIcon={building ? <CircularProgress size={16} color="inherit" /> : <BuildIcon />}
          onClick={onBuild}
          disabled={building || !baseImage}
          title={!baseImage ? 'Base image is required for building' : undefined}
        >
          {building ? 'Building...' : 'Build Image'}
        </Button>
      </Box>

      {/* Build output */}
      {buildOutput && (
        <Alert severity="info" sx={{ mt: 2, '& .MuiAlert-message': { width: '100%' } }}>
          <Box
            component="pre"
            sx={{
              m: 0,
              width: '100%',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              maxHeight: 300,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {buildOutput}
          </Box>
        </Alert>
      )}

      {/* Build error */}
      {buildError && (
        <Alert severity="error" sx={{ mt: 2, '& .MuiAlert-message': { width: '100%' } }}>
          <Box
            component="pre"
            sx={{
              m: 0,
              width: '100%',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              maxHeight: 200,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {buildError}
          </Box>
        </Alert>
      )}
    </>
  );
}

export default EditModeBuildTab;
