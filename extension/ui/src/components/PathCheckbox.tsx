/**
 * PathCheckbox component - Individual path checkbox with dependency info.
 *
 * Extracted from GitRepoCard for better reusability and testability.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import BlockIcon from '@mui/icons-material/Block';
import LockIcon from '@mui/icons-material/Lock';

import { BundleInfo, DependencyResolution } from '../types';
import { PathInfo } from '../utils';

/** Props for PathCheckbox component */
export interface PathCheckboxProps {
  /** Path information */
  pathInfo: PathInfo;
  /** Whether the path is currently selected */
  isSelected: boolean;
  /** Selection info from dependency resolver */
  selectionInfo: DependencyResolution;
  /** Deselection info (only provided when isSelected is true) */
  deselectionInfo: { canDeselect: boolean; requiredBy: BundleInfo[] } | null;
  /** Whether an update is in progress */
  isUpdating: boolean;
  /** Callback when the path is toggled */
  onToggle: () => void;
  /** Callback to show dependency confirmation dialog */
  onShowDependencyDialog: () => void;
}

/**
 * PathCheckbox - Displays a path with its selection state and dependency info.
 *
 * Shows visual indicators for:
 * - Blocked paths (can't be selected due to missing dependencies)
 * - Protected paths (can't be deselected because other paths depend on them)
 * - Paths with dependencies (will auto-select other paths)
 */
export function PathCheckbox({
  pathInfo,
  isSelected,
  selectionInfo,
  deselectionInfo,
  isUpdating,
  onToggle,
  onShowDependencyDialog,
}: PathCheckboxProps) {
  const isBlocked = !selectionInfo.canSelect;
  const isProtected = !!(isSelected && deselectionInfo && !deselectionInfo.canDeselect);
  const hasDepsToSelect = selectionInfo.willAutoSelect.length > 0;

  // Build tooltip text
  let tooltipText = '';
  if (isBlocked) {
    tooltipText = `Blocked: requires ${selectionInfo.blockedBy.join(', ')} (not in any configured repository)`;
  } else if (isProtected && deselectionInfo) {
    const requiredByNames = deselectionInfo.requiredBy.map((b) => b.path).join(', ');
    tooltipText = `Required by: ${requiredByNames}`;
  } else if (hasDepsToSelect && !isSelected) {
    const depsToAdd = selectionInfo.willAutoSelect.map((b) => b.path).join(', ');
    tooltipText = `Will also enable: ${depsToAdd}`;
  }

  const handleCheckboxChange = () => {
    if (isBlocked || isProtected) return;

    if (isSelected) {
      // Deselecting - simple toggle
      onToggle();
    } else if (hasDepsToSelect) {
      // Selecting with dependencies - show confirmation dialog
      onShowDependencyDialog();
    } else {
      // Simple selection without dependencies
      onToggle();
    }
  };

  return (
    <Tooltip
      title={tooltipText}
      placement="right"
      disableHoverListener={!tooltipText}
    >
      <FormControlLabel
        sx={{ my: -0.25 }}
        control={
          <Checkbox
            checked={isSelected}
            onChange={handleCheckboxChange}
            size="small"
            disabled={isUpdating || isBlocked || isProtected}
            sx={{ py: 0.5 }}
            icon={isBlocked ? <BlockIcon fontSize="small" color="error" /> : undefined}
            checkedIcon={isProtected ? <LockIcon fontSize="small" color="info" /> : undefined}
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                color: isBlocked ? 'error.main' : isProtected ? 'info.main' : 'text.primary',
              }}
            >
              {pathInfo.path}
            </Typography>
            {isProtected && deselectionInfo && (
              <Chip
                size="small"
                label={`required by ${deselectionInfo.requiredBy.length}`}
                color="info"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.7rem' }}
              />
            )}
            {hasDepsToSelect && !isSelected && (
              <Chip
                size="small"
                label={`+${selectionInfo.willAutoSelect.length} deps`}
                color="warning"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.7rem' }}
              />
            )}
            {isBlocked && (
              <Chip
                size="small"
                label="blocked"
                color="error"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.7rem' }}
              />
            )}
          </Box>
        }
      />
    </Tooltip>
  );
}

export default PathCheckbox;
