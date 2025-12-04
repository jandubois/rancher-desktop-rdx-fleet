/**
 * EditableHeaderIcon component - Header icon with edit mode support.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HeightIcon from '@mui/icons-material/Height';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { CustomIcon } from './IconUpload';
import { useFileUpload, DEFAULT_ACCEPTED_TYPES, DEFAULT_MAX_SIZE } from '../hooks/useFileUpload';
import { DEFAULT_ICON_HEIGHT, MAX_ICON_HEIGHT, MIN_ICON_HEIGHT } from '../utils/extensionStateStorage';

// Icon state: null = default, CustomIcon = custom, 'deleted' = explicitly no icon
export type IconState = CustomIcon | null | 'deleted';

// Default Fleet icon SVG component with dynamic height
const DefaultFleetIcon = ({ height }: { height: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 135.97886 111.362" style={{ height, width: 'auto' }}>
    <rect fill="#22ad5f" width="135.97886" height="111.362" rx="14.39243"/>
    <path fill="#fff" d="M108.734,68.40666c-.31959-.70715-.62976-1.41735-.95818-2.12167A192.12367,192.12367,0,0,0,87.66084,32.59744q-2.86843-3.84771-5.93119-7.55V74.33785h29.575Q110.07441,71.35528,108.734,68.40666Zm-21.07312,0V42.829a186.742,186.742,0,0,1,14.55423,25.57769Z"/>
    <path fill="#fff" d="M70.04392,14.80415A192.53573,192.53573,0,0,0,41.96357,68.40666c-.6645,1.96876-1.30338,3.94462-1.90258,5.93119H75.97512V7.25412Q72.91337,10.95651,70.04392,14.80415Zm0,53.60251H48.22507a187.12611,187.12611,0,0,1,21.81885-43.371Z"/>
    <path fill="#fff" d="M30.85013,74.33785h6.16628A186.918,186.918,0,0,1,68.31,12.10434L60.8196,16.65309c-1.82193,1.10623-3.634,2.25062-5.42293,3.41521A193.18859,193.18859,0,0,0,30.85013,74.33785Z"/>
    <path fill="#fff" d="M21.74541,74.33785h6.12516A186.4801,186.4801,0,0,1,39.34147,42.4755q3.98814-8.55262,8.77147-16.59091-6.05757,4.39768-11.79853,9.2389Q35.11151,37.528,33.966,39.96893A192.29628,192.29628,0,0,0,21.74541,74.33785Z"/>
    <path fill="#fff" d="M111.5533,86.70839v7.12988l-62.09479.13148-4.46034-7.1406,66.55513-.12076m5.93119-5.94206-83.17239.151L46.17449,99.9079l71.31-.151V80.76633Z"/>
    <path fill="#fff" d="M43.10887,99.9079,31.24652,80.91736H24.25323L36.11561,99.9079Z"/>
    <path fill="#fff" d="M33.15,99.9079,21.28768,80.91736h-6.9933L26.15677,99.9079Z"/>
  </svg>
);

interface EditableHeaderIconProps {
  iconState: IconState;
  onChange: (icon: IconState) => void;
  editMode: boolean;
  iconHeight?: number;
  onIconHeightChange?: (height: number) => void;
}

export function EditableHeaderIcon({
  iconState,
  onChange,
  editMode,
  iconHeight = DEFAULT_ICON_HEIGHT,
  onIconHeightChange,
}: EditableHeaderIconProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeButtonOffset, setResizeButtonOffset] = useState(0); // Vertical offset from center during drag
  const [isAtLimit, setIsAtLimit] = useState(false); // True when at min or max height
  const resizeStartY = useRef<number>(0);
  const resizeStartHeight = useRef<number>(iconHeight);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle resize drag
  useEffect(() => {
    if (!isResizing || !onIconHeightChange) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Moving up = larger icon, moving down = smaller icon
      const cursorDeltaY = e.clientY - resizeStartY.current; // Positive = cursor moved down
      const rawHeight = resizeStartHeight.current - cursorDeltaY;
      const newHeight = Math.min(MAX_ICON_HEIGHT, Math.max(MIN_ICON_HEIGHT, rawHeight));
      const heightDelta = newHeight - resizeStartHeight.current;

      onIconHeightChange(newHeight);

      // Check if at min/max limit
      setIsAtLimit(rawHeight < MIN_ICON_HEIGHT || rawHeight > MAX_ICON_HEIGHT);

      // Button offset: when icon grows, the 50% position moves DOWN (icon extends downward from fixed top)
      // So we need to move button UP by cursor movement PLUS the natural downward shift
      setResizeButtonOffset(cursorDeltaY - heightDelta / 2);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeButtonOffset(0); // Reset button to center
      setIsAtLimit(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onIconHeightChange]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = iconHeight;
    setResizeButtonOffset(0);
    setIsAtLimit(false);
    setIsResizing(true);
  }, [iconHeight]);

  // Use the shared file upload hook with auto-clearing errors
  const { error, validateAndProcessFile } = useFileUpload({
    acceptedTypes: DEFAULT_ACCEPTED_TYPES,
    maxSize: DEFAULT_MAX_SIZE,
    errorAutoClearMs: 3000,
  });

  // Determine what to show
  const hasCustomIcon = iconState !== null && iconState !== 'deleted';
  const isDeleted = iconState === 'deleted';
  const showDefaultIcon = iconState === null;

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!editMode) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const result = await validateAndProcessFile(files[0]);
      if (result) {
        onChange(result as CustomIcon);
      }
    }
  }, [editMode, onChange, validateAndProcessFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editMode) {
      setIsDragging(true);
    }
  }, [editMode]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    if (editMode) {
      fileInputRef.current?.click();
    }
  }, [editMode]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const result = await validateAndProcessFile(files[0]);
      if (result) {
        onChange(result as CustomIcon);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onChange, validateAndProcessFile]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('deleted');  // Explicitly delete the icon
  }, [onChange]);

  // Get the preview URL for custom icon
  const customIconUrl = hasCustomIcon
    ? `data:${(iconState as CustomIcon).mimeType};base64,${(iconState as CustomIcon).data}`
    : null;

  // In non-edit mode with deleted icon, render nothing (title will shift left)
  if (!editMode && isDeleted) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: editMode ? 'pointer' : 'default',
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      {/* Icon container - width adjusts to content, height is dynamic */}
      <Box
        sx={{
          position: 'relative',
          height: iconHeight,
          minWidth: iconHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          transition: isResizing ? 'none' : 'all 0.2s ease',
          ...(editMode && {
            border: '2px dashed',
            borderColor: isDragging ? 'warning.light' : isHovering ? 'rgba(255,255,255,0.5)' : isDeleted ? 'rgba(255,255,255,0.3)' : 'transparent',
            bgcolor: isDragging ? 'rgba(255,255,255,0.1)' : 'transparent',
          }),
        }}
      >
        {/* Show custom icon - height dynamic, width auto for aspect ratio */}
        {customIconUrl && (
          <img
            src={customIconUrl}
            alt="Extension icon"
            style={{
              height: iconHeight,
              width: 'auto',
              objectFit: 'contain',
              borderRadius: 4,
            }}
          />
        )}

        {/* Show default Fleet icon */}
        {showDefaultIcon && <DefaultFleetIcon height={iconHeight} />}

        {/* Show empty placeholder in edit mode when deleted */}
        {editMode && isDeleted && !isDragging && (
          <AddPhotoAlternateIcon
            sx={{
              color: isHovering ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)',
              fontSize: 28,
              transition: 'color 0.2s ease',
            }}
          />
        )}

        {/* Edit overlay - shown on hover in edit mode (only when there's an icon) */}
        {editMode && isHovering && !isDragging && !isDeleted && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(0,0,0,0.5)',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <EditIcon sx={{ color: 'white', fontSize: 20 }} />
          </Box>
        )}

        {/* Drop indicator */}
        {editMode && isDragging && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(255,255,255,0.2)',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
              Drop
            </Typography>
          </Box>
        )}
      </Box>

      {/* Delete button - shown when there's an icon (custom or default) in edit mode */}
      {editMode && !isDeleted && isHovering && (
        <Tooltip title="Remove icon">
          <IconButton
            size="small"
            onClick={handleDelete}
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              bgcolor: 'error.main',
              color: 'white',
              width: 20,
              height: 20,
              '&:hover': {
                bgcolor: 'error.dark',
              },
            }}
          >
            <DeleteIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* Resize button - drag up/down to resize icon, positioned on left edge */}
      {editMode && !isDeleted && (isHovering || isResizing) && onIconHeightChange && (
        <Tooltip title="Drag to resize">
          <IconButton
            size="small"
            onMouseDown={handleResizeStart}
            sx={{
              position: 'absolute',
              left: -10,
              top: '50%',
              transform: `translateY(calc(-50% + ${resizeButtonOffset}px))`,
              bgcolor: isAtLimit ? 'error.main' : isResizing ? 'primary.dark' : 'primary.main',
              color: 'white',
              width: 20,
              height: 20,
              cursor: 'ns-resize',
              transition: isResizing ? 'none' : 'transform 0.15s ease-out, background-color 0.15s ease-out',
              '&:hover': {
                bgcolor: isAtLimit ? 'error.dark' : 'primary.dark',
              },
            }}
          >
            {isAtLimit ? <CloseIcon sx={{ fontSize: 14 }} /> : <HeightIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
      )}

      {/* Error tooltip */}
      {error && (
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            mt: 1,
            px: 1,
            py: 0.5,
            bgcolor: 'error.main',
            color: 'white',
            borderRadius: 1,
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
            zIndex: 1000,
          }}
        >
          {error}
        </Box>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={DEFAULT_ACCEPTED_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </Box>
  );
}
