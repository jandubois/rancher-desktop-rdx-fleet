import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SyncIcon from '@mui/icons-material/Sync';
import EditIcon from '@mui/icons-material/Edit';
import EditOffIcon from '@mui/icons-material/EditOff';
import BlockIcon from '@mui/icons-material/Block';
import LockIcon from '@mui/icons-material/Lock';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

// Local imports
import { loadManifest, Manifest, DEFAULT_MANIFEST, CardDefinition, MarkdownCardSettings, HtmlCardSettings, GitRepoCardSettings, ImageCardSettings, VideoCardSettings, LinkCardSettings, DividerCardSettings, CardType } from './manifest';
import type { ColorPalette } from './theme';
import { CardWrapper, getCardComponent } from './cards';
import { SortableCard, AddRepoDialog, EditableTitle, EditModePanel, EditableHeaderIcon, IconState } from './components';
import { useFleetStatus, useGitRepoManagement, usePalette, usePathDiscovery, useDependencyResolver } from './hooks';
import { PathInfo } from './utils';
import { GitRepo, BundleInfo } from './types';

// =============================================================================
// PATH DISCOVERY DESIGN NOTES
// =============================================================================
//
// We use the GitHub API to discover available paths (directories containing
// fleet.yaml or fleet.yml files) in a repository. This approach was chosen
// after exploring Fleet-based alternatives that didn't work reliably.
//
// See utils/github.ts for implementation details.
// =============================================================================

function App() {
  // Manifest and edit mode state
  const [manifest, setManifest] = useState<Manifest>(DEFAULT_MANIFEST);
  const [editMode, setEditMode] = useState(false);
  const [manifestCards, setManifestCards] = useState<CardDefinition[]>(DEFAULT_MANIFEST.cards);

  // Color palette from manifest
  const palette = usePalette(manifest);

  // Card order for drag-and-drop (IDs of all cards in display order)
  const [cardOrder, setCardOrder] = useState<string[]>(['fleet-status']);

  // Titles for dynamic cards (fleet-status, gitrepo-*) that aren't in manifestCards
  const [dynamicCardTitles, setDynamicCardTitles] = useState<Record<string, string>>({});

  // Icon state for extension builder: null = default, CustomIcon = custom, 'deleted' = no icon
  const [iconState, setIconState] = useState<IconState>(null);

  // Add repo dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Path discovery
  const {
    repoPathsCache,
    discoveryErrors,
    discoveryStartTimes,
    isLoadingPaths,
    discoverPathsForRepo,
    clearDiscoveryCache,
  } = usePathDiscovery();

  // Dependency confirmation dialog state
  const [dependencyDialog, setDependencyDialog] = useState<{
    open: boolean;
    gitRepoName: string;
    path: string;
    willAutoSelect: BundleInfo[];
  }>({ open: false, gitRepoName: '', path: '', willAutoSelect: [] });

  // Fleet status hook
  const {
    fleetState,
    installing,
    installFleet,
  } = useFleetStatus({
    onFleetReady: () => {
      // Fetch git repos when fleet becomes ready
      fetchGitRepos();
    },
  });

  // GitRepo management hook
  const {
    gitRepos,
    loadingRepos,
    repoError,
    updatingRepo,
    fetchGitRepos,
    addGitRepo,
    deleteGitRepo,
    toggleRepoPath,
    updateGitRepoPaths,
    clearRepoError,
  } = useGitRepoManagement({
    fleetState,
    onReposLoaded: (repos) => {
      // Auto-discover paths for repos that don't have cached paths
      repos.forEach((repo) => {
        if (repoPathsCache[repo.repo] === undefined && !isLoadingPaths(repo.repo)) {
          discoverPathsForRepo(repo.repo, repo.branch);
        }
      });
    },
  });

  // Dependency resolver
  const {
    getSelectionInfo,
    getPathsToSelect,
    canDeselect,
  } = useDependencyResolver({
    gitRepos,
    repoPathsCache,
  });

  // Build currently selected paths map for dependency resolution
  const currentlySelectedPaths = useMemo(() => {
    const selected = new Map<string, Set<string>>();
    for (const repo of gitRepos) {
      if (repo.paths && repo.paths.length > 0) {
        selected.set(repo.name, new Set(repo.paths));
      }
    }
    return selected;
  }, [gitRepos]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end - reorder cards
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCardOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Compute effective card order: filter deleted cards and add new ones
  const effectiveCardOrder = useMemo(() => {
    const gitRepoIds = gitRepos.map((r) => `gitrepo-${r.name}`);
    const manifestCardIds = manifestCards
      .filter((c) => c.type === 'markdown' || c.type === 'image' || c.type === 'video' || c.type === 'link' || c.type === 'divider' || c.type === 'placeholder')
      .map((c) => c.id);
    const allValidIds = new Set(['fleet-status', ...gitRepoIds, ...manifestCardIds]);

    // Filter out deleted cards from user's preferred order
    const filtered = cardOrder.filter((id) => allValidIds.has(id));

    // Add new cards that aren't in the order yet
    const existingIds = new Set(filtered);
    const newIds = [...allValidIds].filter((id) => !existingIds.has(id));

    return [...filtered, ...newIds];
  }, [cardOrder, gitRepos, manifestCards]);

  // Load manifest on startup
  useEffect(() => {
    loadManifest().then((m) => {
      setManifest(m);
      setManifestCards(m.cards);
    });
  }, []);

  // Track current time for timeout checks (updated every 5s when there are active discovery operations)
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const hasActiveDiscovery = Object.keys(discoveryStartTimes).length > 0;
    if (!hasActiveDiscovery) return;

    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);

    return () => clearInterval(timer);
  }, [discoveryStartTimes]);

  // Counter for generating unique placeholder IDs
  const placeholderIdCounter = useRef(0);

  // Handle config loaded from external source (image or ZIP)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleConfigLoaded = useCallback((loadedManifest: Manifest, _sourceName: string) => {
    // Update manifest state
    setManifest(loadedManifest);
    setManifestCards(loadedManifest.cards);

    // Reset card order to include new cards from loaded manifest
    const newManifestCardIds = loadedManifest.cards
      .filter((c) => c.type !== 'gitrepo') // gitrepo cards are dynamic, not from manifest
      .map((c) => c.id);
    const gitRepoIds = gitRepos.map((r) => `gitrepo-${r.name}`);

    // Build new card order: fleet-status first, then loaded manifest cards, then gitrepo cards
    setCardOrder(['fleet-status', ...newManifestCardIds, ...gitRepoIds]);
  }, [gitRepos]);

  // Handle extension title change in header
  const handleExtensionTitleChange = useCallback((title: string) => {
    setManifest((prev) => ({
      ...prev,
      app: {
        ...prev.app,
        name: title,
      },
    }));
  }, []);

  // Handle palette change from Edit tab
  const handlePaletteChange = useCallback((palette: ColorPalette) => {
    setManifest((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        palette,
      },
    }));
  }, []);

  // Open add repo dialog
  const openAddRepoDialog = useCallback(() => {
    setAddDialogOpen(true);
  }, []);

  // Handle add repo from dialog
  const handleAddRepo = useCallback(async (name: string, url: string, branch?: string) => {
    return addGitRepo(name, url, branch);
  }, [addGitRepo]);

  // Handle delete repo with confirmation
  const handleDeleteRepo = useCallback(async (name: string) => {
    if (!confirm(`Delete GitRepo "${name}"?`)) return;
    await deleteGitRepo(name);
  }, [deleteGitRepo]);

  // Render status icon
  const renderStatusIcon = () => {
    switch (fleetState.status) {
      case 'checking':
        return <CircularProgress size={24} />;
      case 'initializing':
        return <SyncIcon color="info" sx={{ animation: 'spin 2s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />;
      case 'running':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return null;
    }
  };

  // Get repo status chip
  const getRepoStatusChip = (repo: GitRepo) => {
    if (!repo.status) {
      return <Chip label="Unknown" size="small" />;
    }
    if (repo.status.ready) {
      const resourceCount = repo.status.resources?.length || 0;
      return (
        <Chip
          label={`Ready${resourceCount > 0 ? ` (${resourceCount})` : ''}`}
          color="success"
          size="small"
          icon={<CheckCircleIcon />}
        />
      );
    }

    if (repo.status.display?.error) {
      return (
        <Chip
          label="Error"
          color="error"
          size="small"
          icon={<ErrorIcon />}
        />
      );
    }

    const state = repo.status.display?.state || 'Syncing';
    const stateLabels: Record<string, string> = {
      'GitUpdating': 'Cloning...',
      'WaitApplied': 'Applying...',
      'Active': 'Deploying...',
      'Modified': 'Updating...',
    };

    return (
      <Chip
        label={stateLabels[state] || state}
        color="info"
        size="small"
        icon={<SyncIcon sx={{ animation: 'spin 2s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />}
        title={repo.status.display?.message}
      />
    );
  };

  // Render an uninitialized GitRepo card (no repo configured yet)
  const renderUninitializedCard = () => {
    return (
      <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'grey.300', boxShadow: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 2 }}>
          <Typography variant="h6" color="text.secondary">
            Git Repository
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            No repository configured yet.
          </Typography>
          <Button
            variant="contained"
            onClick={openAddRepoDialog}
            startIcon={<AddIcon />}
            disabled={fleetState.status !== 'running'}
          >
            Configure Repository
          </Button>
          {fleetState.status !== 'running' && (
            <Typography variant="caption" color="text.secondary">
              Fleet must be running to configure repositories
            </Typography>
          )}
        </Box>
      </Paper>
    );
  };

  // Render a single GitRepo card
  const renderRepoCard = (repo: GitRepo, _index: number, totalCount: number, maxVisiblePaths: number = 6, cardId?: string) => {
    const availablePaths: PathInfo[] = repoPathsCache[repo.repo] || [];
    const loadingPaths = isLoadingPaths(repo.repo);
    const hasDiscoveredPaths = repoPathsCache[repo.repo] !== undefined;
    const enabledPaths = repo.paths || [];
    const isUpdating = updatingRepo === repo.name;
    const canDelete = totalCount > 1;
    const effectiveCardId = cardId || `gitrepo-${repo.name}`;

    // Check for discovery error or timeout
    const discoveryError = discoveryErrors[repo.repo];
    const discoveryStartTime = discoveryStartTimes[repo.repo];
    const isTimedOut = discoveryStartTime && (currentTime - discoveryStartTime) > 30000;

    // Retry handler
    const handleRetryDiscovery = () => {
      clearDiscoveryCache(repo.repo);
      discoverPathsForRepo(repo.repo, repo.branch, true);
    };

    return (
      <>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <EditableTitle
                value={getDynamicCardTitle(effectiveCardId, repo.name)}
                editMode={editMode}
                onChange={handleDynamicTitleChange(effectiveCardId)}
                placeholder={repo.name}
              />
              {getRepoStatusChip(repo)}
              {isUpdating && <CircularProgress size={16} />}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {repo.repo}
            </Typography>
            {repo.branch && (
              <Typography variant="caption" color="text.secondary">
                Branch: {repo.branch}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={openAddRepoDialog}
              title="Add another repository"
              disabled={fleetState.status !== 'running'}
            >
              <AddIcon />
            </IconButton>
            {canDelete && (
              <IconButton
                size="small"
                onClick={() => handleDeleteRepo(repo.name)}
                title="Delete repository"
                disabled={isUpdating}
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Error message if any */}
        {repo.status?.display?.error && repo.status.display.message && (
          <Alert severity="error" sx={{ my: 1, fontSize: '0.85rem' }}>
            {repo.status.display.message}
          </Alert>
        )}

        <Divider sx={{ my: 1.5 }} />

        {/* Paths */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2">
            Paths{enabledPaths.length > 0 ? ` (${enabledPaths.length} deployed)` : ''}
          </Typography>
          {loadingPaths && <CircularProgress size={12} />}
        </Box>

        {/* Discovery error with retry */}
        {discoveryError && !loadingPaths && (
          <Alert
            severity="warning"
            sx={{ mb: 1 }}
            action={
              <Button color="inherit" size="small" onClick={handleRetryDiscovery}>
                Retry
              </Button>
            }
          >
            {discoveryError}
          </Alert>
        )}

        {/* Timeout warning with retry */}
        {isTimedOut && loadingPaths && (
          <Alert
            severity="info"
            sx={{ mb: 1 }}
            action={
              <Button color="inherit" size="small" onClick={handleRetryDiscovery}>
                Retry
              </Button>
            }
          >
            Path discovery is taking longer than expected...
          </Alert>
        )}

        {availablePaths.length > 0 ? (
          <Box
            sx={{
              pl: 1,
              ...(availablePaths.length > maxVisiblePaths && {
                maxHeight: maxVisiblePaths * 32,
                overflowY: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
              }),
            }}
          >
            <FormGroup sx={{ gap: 0 }}>
              {availablePaths.map((pathInfo) => {
                const isSelected = enabledPaths.includes(pathInfo.path);
                const selectionInfo = getSelectionInfo(repo.name, pathInfo.path, currentlySelectedPaths);
                const deselectionInfo = isSelected ? canDeselect(repo.name, pathInfo.path, currentlySelectedPaths) : null;

                // Determine checkbox state
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

                // Handle checkbox change with dependency awareness
                const handleCheckboxChange = () => {
                  if (isBlocked || isProtected) return;

                  if (isSelected) {
                    // Deselecting - simple toggle
                    toggleRepoPath(repo, pathInfo.path);
                  } else if (hasDepsToSelect) {
                    // Selecting with dependencies - show confirmation dialog
                    setDependencyDialog({
                      open: true,
                      gitRepoName: repo.name,
                      path: pathInfo.path,
                      willAutoSelect: selectionInfo.willAutoSelect,
                    });
                  } else {
                    // Simple selection without dependencies
                    toggleRepoPath(repo, pathInfo.path);
                  }
                };

                return (
                  <Tooltip
                    key={pathInfo.path}
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
              })}
            </FormGroup>
          </Box>
        ) : loadingPaths && !isTimedOut ? (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
            Discovering available paths...
          </Typography>
        ) : !hasDiscoveredPaths && !discoveryError ? (
          <Box sx={{ pl: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Click to discover available paths
            </Typography>
            <Button size="small" onClick={() => discoverPathsForRepo(repo.repo, repo.branch, true)}>
              Discover
            </Button>
          </Box>
        ) : hasDiscoveredPaths && availablePaths.length === 0 && !discoveryError ? (
          enabledPaths.length > 0 ? (
            <Box sx={{ pl: 1 }}>
              {enabledPaths.map((path) => (
                <Chip key={path} label={path} size="small" sx={{ mr: 0.5, mb: 0.5, fontFamily: 'monospace' }} />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
              No fleet.yaml files found. Deploying all paths (root).
            </Typography>
          )
        ) : null}

        {/* Resources summary */}
        {repo.status?.resources && repo.status.resources.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Resources ({repo.status.resources.length})
            </Typography>
            <Box sx={{ pl: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {repo.status.resources.map((resource, idx) => (
                <Chip
                  key={idx}
                  label={`${resource.kind}/${resource.name}`}
                  size="small"
                  color={resource.state === 'Ready' ? 'success' : resource.state === 'WaitApplied' ? 'info' : 'default'}
                  variant="outlined"
                />
              ))}
            </Box>
          </>
        )}
      </>
    );
  };

  // Render a manifest card (markdown, image, etc.)
  const renderManifestCard = (card: CardDefinition, index: number) => {
    // Skip gitrepo and auth cards for now - they're handled separately
    if (card.type === 'gitrepo' || card.type.startsWith('auth-')) {
      return null;
    }

    const CardComponent = getCardComponent(card.type);
    if (!CardComponent) {
      console.warn(`[Cards] Unknown card type: ${card.type}`);
      return null;
    }

    const handleSettingsChange = (newSettings: typeof card.settings) => {
      setManifestCards((prev) => {
        const next = [...prev];
        next[index] = { ...card, settings: newSettings };
        return next;
      });
    };

    const handleTitleChange = (title: string) => {
      setManifestCards((prev) => {
        const next = [...prev];
        next[index] = { ...card, title: title || undefined };
        return next;
      });
    };

    const handleDelete = () => {
      if (confirm(`Delete this ${card.type} card?`)) {
        setManifestCards((prev) => prev.filter((_, i) => i !== index));
      }
    };

    const handleVisibilityToggle = () => {
      setManifestCards((prev) => {
        const next = [...prev];
        next[index] = { ...card, visible: card.visible === false ? true : false };
        return next;
      });
    };

    return (
      <CardWrapper
        key={card.id}
        definition={card}
        editMode={editMode}
        onDelete={handleDelete}
        onVisibilityToggle={handleVisibilityToggle}
        onTitleChange={handleTitleChange}
        paletteColors={palette.card}
      >
        <CardComponent
          definition={card}
          settings={card.settings || {}}
          editMode={editMode}
          onSettingsChange={handleSettingsChange}
        />
      </CardWrapper>
    );
  };

  // Check if edit mode is allowed
  const editModeAllowed = manifest.layout?.edit_mode !== false;

  // Handle exiting edit mode - remove placeholder cards
  const handleExitEditMode = () => {
    setManifestCards((prev) => prev.filter((c) => c.type !== 'placeholder'));
    setEditMode(false);
  };

  // Insert a placeholder card after a given card ID
  const insertCardAfter = (afterCardId: string) => {
    placeholderIdCounter.current += 1;
    const newCard: CardDefinition = {
      id: `placeholder-${placeholderIdCounter.current}`,
      type: 'placeholder',
      title: 'New Card',
    };
    setManifestCards((prev) => [...prev, newCard]);
    setCardOrder((prev) => {
      const index = prev.indexOf(afterCardId);
      if (index === -1) return [...prev, newCard.id];
      return [...prev.slice(0, index + 1), newCard.id, ...prev.slice(index + 1)];
    });
  };

  // Get default settings for a card type
  const getDefaultSettingsForCardType = (cardType: CardType): CardDefinition['settings'] => {
    switch (cardType) {
      case 'markdown':
        return { content: '## New Card\n\nEdit this content...' } as MarkdownCardSettings;
      case 'html':
        return { content: '<!-- Enter HTML content here -->\n<div>\n  <p>Hello World</p>\n</div>' } as HtmlCardSettings;
      case 'image':
        return { src: '', alt: '' } as ImageCardSettings;
      case 'video':
        return { src: '', title: '' } as VideoCardSettings;
      case 'link':
        return { links: [{ label: 'Example Link', url: 'https://example.com' }], variant: 'buttons' } as LinkCardSettings;
      case 'divider':
        return { label: '', style: 'solid' } as DividerCardSettings;
      default:
        return {};
    }
  };

  // Convert a placeholder card to a specific type
  const convertPlaceholderCard = (cardId: string, newType: CardType) => {
    if (newType === 'gitrepo') {
      openAddRepoDialog();
      setManifestCards((prev) => prev.filter((c) => c.id !== cardId));
      setCardOrder((prev) => prev.filter((id) => id !== cardId));
    } else {
      setManifestCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, type: newType, settings: getDefaultSettingsForCardType(newType) }
            : c
        )
      );
    }
  };

  // Render a placeholder card with type selector
  const renderPlaceholderCard = (card: CardDefinition) => {
    const cardTypes: { type: CardType; label: string }[] = [
      { type: 'markdown', label: 'Markdown' },
      { type: 'html', label: 'HTML' },
      { type: 'image', label: 'Image' },
      { type: 'video', label: 'Video' },
      { type: 'link', label: 'Links' },
      { type: 'divider', label: 'Divider' },
      { type: 'gitrepo', label: 'Git Repository' },
    ];

    return (
      <Paper sx={{ p: 2, mb: 2, border: '2px dashed', borderColor: 'primary.main', boxShadow: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2, gap: 2 }}>
          <Typography variant="subtitle1" color="text.secondary">
            Select card type:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
            {cardTypes.map(({ type, label }) => (
              <Button
                key={type}
                variant="outlined"
                size="small"
                onClick={() => convertPlaceholderCard(card.id, type)}
              >
                {label}
              </Button>
            ))}
          </Box>
        </Box>
      </Paper>
    );
  };

  // Render the "add card below" button
  const renderAddCardButton = (afterCardId: string) => {
    if (!editMode) return null;
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => insertCardAfter(afterCardId)}
          sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
        >
          Add card
        </Button>
      </Box>
    );
  };

  // Helper to get/set dynamic card title
  const getDynamicCardTitle = (cardId: string, defaultTitle: string) => {
    return dynamicCardTitles[cardId] ?? defaultTitle;
  };

  const handleDynamicTitleChange = (cardId: string) => (title: string) => {
    setDynamicCardTitles((prev) => ({
      ...prev,
      [cardId]: title,
    }));
  };

  // Render a card by ID
  const renderCardById = (cardId: string) => {
    // Fleet Status card
    if (cardId === 'fleet-status') {
      const fleetStatusDef: CardDefinition = {
        id: 'fleet-status',
        type: 'status' as CardDefinition['type'],
        title: getDynamicCardTitle('fleet-status', 'Fleet Status'),
      };

      const statusSuffix =
        fleetState.status === 'running' ? `: Running (${fleetState.version})` :
        fleetState.status === 'checking' ? ': Checking...' :
        fleetState.status === 'initializing' ? ': Initializing...' :
        fleetState.status === 'not-installed' ? ': Not Installed' :
        fleetState.status === 'error' ? ': Error' : '';

      return (
        <SortableCard key={cardId} id={cardId} editMode={editMode}>
          <CardWrapper
            definition={fleetStatusDef}
            editMode={editMode}
            paletteColors={palette.card}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: fleetState.status === 'running' ? 0 : 1 }}>
              {renderStatusIcon()}
              <EditableTitle
                value={getDynamicCardTitle('fleet-status', 'Fleet Status')}
                editMode={editMode}
                onChange={handleDynamicTitleChange('fleet-status')}
                placeholder="Fleet Status"
              >
                {!editMode && statusSuffix}
              </EditableTitle>
              {editMode && <Typography variant="h6">{statusSuffix}</Typography>}
            </Box>

            {fleetState.status === 'initializing' && fleetState.message && (
              <Alert severity="info" sx={{ mt: 1 }}>
                {fleetState.message}
              </Alert>
            )}

            {fleetState.status === 'error' && fleetState.error && (
              <Alert severity="error" sx={{ mt: 1, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {fleetState.error}
              </Alert>
            )}

            {fleetState.status === 'not-installed' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={installFleet}
                  disabled={installing}
                >
                  {installing ? 'Installing...' : 'Install Fleet'}
                </Button>
              </Box>
            )}

            {repoError && (
              <Alert severity="error" sx={{ mt: 1 }} onClose={clearRepoError}>
                {repoError}
              </Alert>
            )}
          </CardWrapper>
          {renderAddCardButton(cardId)}
        </SortableCard>
      );
    }

    // Placeholder cards (for type selection) - only if still a placeholder type
    if (cardId.startsWith('placeholder-')) {
      const card = manifestCards.find((c) => c.id === cardId);
      if (!card) return null;
      // If the card has been converted to another type, render it as a manifest card
      if (card.type !== 'placeholder') {
        if (card.visible === false && !editMode) return null;
        const index = manifestCards.indexOf(card);
        return (
          <SortableCard key={cardId} id={cardId} editMode={editMode}>
            {renderManifestCard(card, index)}
            {renderAddCardButton(cardId)}
          </SortableCard>
        );
      }
      return (
        <SortableCard key={cardId} id={cardId} editMode={editMode}>
          {renderPlaceholderCard(card)}
          {renderAddCardButton(cardId)}
        </SortableCard>
      );
    }

    // GitRepo cards
    if (cardId.startsWith('gitrepo-')) {
      const repoName = cardId.replace('gitrepo-', '');
      const repo = gitRepos.find((r) => r.name === repoName);
      if (!repo) return null;

      const gitRepoCardDef = manifestCards.find((c) => c.type === 'gitrepo');
      const maxVisiblePaths = (gitRepoCardDef?.settings as GitRepoCardSettings | undefined)?.max_visible_paths ?? 6;
      const repoIndex = gitRepos.findIndex((r) => r.name === repoName);

      const gitRepoDef: CardDefinition = {
        id: cardId,
        type: 'gitrepo',
        title: getDynamicCardTitle(cardId, repo.name),
      };

      return (
        <SortableCard key={cardId} id={cardId} editMode={editMode}>
          <CardWrapper
            definition={gitRepoDef}
            editMode={editMode}
            paletteColors={palette.card}
          >
            {renderRepoCard(repo, repoIndex, gitRepos.length, maxVisiblePaths, cardId)}
          </CardWrapper>
          {renderAddCardButton(cardId)}
        </SortableCard>
      );
    }

    // Manifest cards (markdown, image, video, link, divider)
    const card = manifestCards.find((c) => c.id === cardId);
    if (card && (card.type === 'markdown' || card.type === 'image' || card.type === 'video' || card.type === 'link' || card.type === 'divider')) {
      if (card.visible === false && !editMode) return null;
      const index = manifestCards.indexOf(card);
      return (
        <SortableCard key={cardId} id={cardId} editMode={editMode}>
          {renderManifestCard(card, index)}
          {renderAddCardButton(cardId)}
        </SortableCard>
      );
    }

    return null;
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: palette.body.background, display: 'flex', flexDirection: 'column' }}>
      {/* Fixed Header */}
      <Box
        sx={{
          bgcolor: palette.header.background,
          color: palette.header.text,
          py: 2,
          boxShadow: 1,
        }}
      >
        <Box sx={{ maxWidth: 900, margin: '0 auto', px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EditableHeaderIcon
              iconState={iconState}
              onChange={setIconState}
              editMode={editMode}
            />
            <EditableTitle
              value={manifest.app?.name || 'Fleet GitOps'}
              editMode={editMode}
              onChange={handleExtensionTitleChange}
              placeholder="Extension Name"
              variant="h6"
            />
          </Box>
          {editModeAllowed && (
            <IconButton
              onClick={() => editMode ? handleExitEditMode() : setEditMode(true)}
              title={editMode ? 'Exit edit mode' : 'Enter edit mode'}
              sx={{ color: editMode ? 'warning.light' : palette.header.text }}
            >
              {editMode ? <EditOffIcon /> : <EditIcon />}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Scrollable Card Area */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 3 }}>
        <Box sx={{ px: 3, maxWidth: 900, margin: '0 auto' }}>
          {/* Edit Mode Panel - shown when in edit mode */}
          {editMode && (
            <EditModePanel
              manifest={manifest}
              cards={manifestCards}
              cardOrder={effectiveCardOrder}
              iconState={iconState}
              resolvedPalette={palette}
              onConfigLoaded={handleConfigLoaded}
              onPaletteChange={handlePaletteChange}
            />
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={effectiveCardOrder} strategy={verticalListSortingStrategy}>
              {/* Render all cards in order */}
              {effectiveCardOrder.map((cardId) => renderCardById(cardId))}

              {/* Show uninitialized card if no gitrepos and fleet is running */}
              {fleetState.status === 'running' && gitRepos.length === 0 && !loadingRepos && (
                <SortableCard id="uninitialized-repo" editMode={editMode}>
                  {renderUninitializedCard()}
                  {renderAddCardButton('uninitialized-repo')}
                </SortableCard>
              )}

              {/* Loading indicator */}
              {loadingRepos && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              )}
            </SortableContext>
          </DndContext>
        </Box>
      </Box>

      {/* Add Repository Dialog */}
      <AddRepoDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddRepo}
      />

      {/* Dependency Confirmation Dialog */}
      <Dialog
        open={dependencyDialog.open}
        onClose={() => setDependencyDialog({ open: false, gitRepoName: '', path: '', willAutoSelect: [] })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Enable Dependencies</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            The path <strong>{dependencyDialog.path}</strong> has dependencies that will also be enabled:
          </DialogContentText>
          <Box sx={{ pl: 2 }}>
            {dependencyDialog.willAutoSelect.map((dep) => (
              <Box key={dep.bundleName} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {dep.path}
                </Typography>
                {dep.gitRepoName !== dependencyDialog.gitRepoName && (
                  <Chip size="small" label={dep.gitRepoName} variant="outlined" sx={{ height: 18, fontSize: '0.7rem' }} />
                )}
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDependencyDialog({ open: false, gitRepoName: '', path: '', willAutoSelect: [] })}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              // Get paths to select for each GitRepo
              const pathsToSelect = getPathsToSelect(dependencyDialog.gitRepoName, dependencyDialog.path);

              // Update each GitRepo with its new paths
              for (const [repoName, pathsToAdd] of pathsToSelect) {
                const repo = gitRepos.find((r) => r.name === repoName);
                if (!repo) continue;

                const currentPaths = repo.paths || [];
                const newPaths = [...new Set([...currentPaths, ...pathsToAdd])];

                if (newPaths.length > currentPaths.length) {
                  updateGitRepoPaths(repo, newPaths);
                }
              }

              setDependencyDialog({ open: false, gitRepoName: '', path: '', willAutoSelect: [] });
            }}
          >
            Enable All
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default App;
