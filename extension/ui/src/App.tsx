import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import BuildIcon from '@mui/icons-material/Build';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RestoreIcon from '@mui/icons-material/Restore';
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
import { loadManifest, Manifest, DEFAULT_MANIFEST, CardDefinition, GitRepoCardSettings, CardType } from './manifest';
import { GitRepo } from './types';
import { loadExtensionState, saveExtensionState, PersistedExtensionState, EditModeSnapshot, DEFAULT_ICON_HEIGHT } from './utils/extensionStateStorage';
import { backendService } from './services/BackendService';
import type { GitRepoConfig } from './utils';

// Get initial state from localStorage (synchronous for lazy useState)
function getInitialState(): PersistedExtensionState | null {
  try {
    return loadExtensionState();
  } catch {
    return null;
  }
}

import type { ColorPalette } from './theme';
import { CardWrapper, getCardComponent, getAddCardMenuItems, getDefaultSettingsForType, getCardMetadata, isCardTypeRegistered } from './cards';
import {
  SortableCard,
  AddRepoDialog,
  EditRepoDialog,
  EditableTitle,
  EditModePanel,
  EditableHeaderIcon,
  IconState,
  CustomIcon,
  GitRepoCard,
  FleetStatusCard,
  BackendStatusCard,
  DependencyConfirmationDialog,
  INITIAL_DEPENDENCY_DIALOG_STATE,
  DependencyDialogState,
  ConfirmDialog,
} from './components';
import { useFleetStatus, useGitRepoManagement, usePalette, usePathDiscovery, useDependencyResolver, useBackendStatus, useBackendInit, useBuilderState } from './hooks';
import { useServices } from './context';
import { extractDominantColor, extractColorsFromSvg } from './utils/colorExtractor';
import { generatePaletteFromColor } from './utils/paletteGenerator';
import { isSvgMimeType } from './utils/mimeTypes';

// Cache the initial state load so all useState initializers see the same value
const cachedInitialState = getInitialState();

function App() {
  // Get services from context (kubernetesService is no longer needed - backend handles K8s ops)
  const { gitHubService, commandExecutor } = useServices();

  // Manifest and runtime state - prefer cached state from localStorage
  const [manifest, setManifest] = useState<Manifest>(
    () => cachedInitialState?.manifest ?? DEFAULT_MANIFEST
  );
  const [manifestCards, setManifestCards] = useState<CardDefinition[]>(
    () => cachedInitialState?.manifestCards ?? DEFAULT_MANIFEST.cards
  );

  // Color palette from manifest
  const palette = usePalette(manifest);

  // Card order for drag-and-drop (IDs of all cards in display order)
  const [cardOrder, setCardOrder] = useState<string[]>(
    () => cachedInitialState?.cardOrder ?? ['fleet-status']
  );

  // Titles for dynamic cards (fleet-status, gitrepo-*) that aren't in manifestCards
  const [dynamicCardTitles, setDynamicCardTitles] = useState<Record<string, string>>(
    () => cachedInitialState?.dynamicCardTitles ?? {}
  );

  // Builder state (edit mode, icon, snapshot, etc.) - consolidated into hook
  const {
    editMode,
    iconState,
    iconHeight,
    titleWarning,
    confirmResetOpen,
    editModeSnapshot,
    activeEditTab,
    enterEditMode,
    applyEditMode,
    cancelEditMode,
    setIconState,
    setIconHeight,
    setTitleWarning,
    setActiveEditTab,
    openResetDialog,
    closeResetDialog,
  } = useBuilderState({
    initial: {
      editMode: cachedInitialState?.editMode,
      iconState: cachedInitialState?.iconState,
      iconHeight: cachedInitialState?.iconHeight,
      editModeSnapshot: cachedInitialState?.editModeSnapshot,
      activeEditTab: cachedInitialState?.activeEditTab,
    },
    runtimeState: { manifest, manifestCards, cardOrder, dynamicCardTitles },
    runtimeSetters: { setManifest, setManifestCards, setCardOrder, setDynamicCardTitles },
  });

  // Add repo dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Edit repo dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRepo, setEditingRepo] = useState<GitRepo | null>(null);

  // Path discovery with injected service
  const {
    repoPathsCache,
    discoveryErrors,
    discoveryStartTimes,
    isLoadingPaths,
    discoverPathsForRepo,
    clearDiscoveryCache,
  } = usePathDiscovery({ gitHubService });

  // Dependency confirmation dialog state
  const [dependencyDialog, setDependencyDialog] = useState<DependencyDialogState>(INITIAL_DEPENDENCY_DIALOG_STATE);

  // Fleet status hook (uses backend service)
  // Fleet is auto-installed by the backend, so no manual install function needed
  const {
    fleetState,
  } = useFleetStatus({
    onFleetReady: () => {
      fetchGitRepos();
    },
  });

  // GitRepo management hook (uses backend service)
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
    updateGitRepoConfig,
    clearRepoError,
    clearAllGitRepos,
  } = useGitRepoManagement({
    fleetState,
    manifestCards,  // Pass manifest cards for initializing from defaults
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

  // Backend status (for debugging)
  const {
    status: backendStatus,
    loading: backendLoading,
    refresh: refreshBackend,
  } = useBackendStatus({ pollInterval: 30000 });

  // Backend initialization (sends extension list and kubeconfig to backend)
  // These variables are intentionally prefixed with _ as they're tracked by backend status
  const {
    initialized: _backendInitialized,
    ownership: _ownershipStatus,
    error: _initError,
    retry: _retryInit,
  } = useBackendInit({
    commandExecutor,
    backendConnected: backendStatus?.connected ?? false,
    onInitialized: (ownership) => {
      console.log('[App] Backend initialized, ownership:', ownership.status);
      // Refresh backend status to pick up new init status
      refreshBackend();
    },
  });
  // Log init state for debugging (prevent unused variable warnings)
  console.debug('[App] Backend init state:', { _backendInitialized, _initError, _ownershipStatus, _retryInit });

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

  // Convert gitRepos to GitRepoConfig format for extension building
  // This stores the current repo configuration as defaults in the manifest
  const gitRepoConfigs: GitRepoConfig[] = useMemo(() => {
    return gitRepos.map(repo => ({
      name: repo.name,
      repo: repo.repo,
      branch: repo.branch,
      paths: repo.paths || [],
    }));
  }, [gitRepos]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Compute effective card order: filter deleted cards and add new ones
  const effectiveCardOrder = useMemo(() => {
    const gitRepoIds = gitRepos.map((r) => `gitrepo-${r.name}`);
    // Use registry to determine which card types are orderable
    const manifestCardIds = manifestCards
      .filter((c) => isCardTypeRegistered(c.type) || c.type === 'placeholder')
      .map((c) => c.id);
    // Order matters for Set iteration: manifest cards before gitRepos so new
    // gitRepos appear after manifest cards (matching uninitialized-repo placeholder position)
    const allValidIds = new Set(['fleet-status', ...manifestCardIds, ...gitRepoIds]);

    // Filter out deleted cards from user's preferred order
    const filtered = cardOrder.filter((id) => allValidIds.has(id));

    // Add new cards that aren't in the order yet
    const existingIds = new Set(filtered);
    const newIds = [...allValidIds].filter((id) => !existingIds.has(id));

    return [...filtered, ...newIds];
  }, [cardOrder, gitRepos, manifestCards]);

  // Handle drag end - reorder cards
  // NOTE: Must use effectiveCardOrder for index lookup since that's what's rendered
  // in SortableContext. cardOrder may not contain dynamically added items like gitrepos.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = effectiveCardOrder.indexOf(active.id as string);
      const newIndex = effectiveCardOrder.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        setCardOrder(arrayMove(effectiveCardOrder, oldIndex, newIndex));
      }
    }
  };

  // Load manifest file on startup if no cached state exists
  // State is already initialized from cachedInitialState in useState calls above
  useEffect(() => {
    if (cachedInitialState) {
      // State was restored from localStorage via lazy useState initializers
      initialLoadComplete.current = true;
    } else {
      // No cached state - load from manifest file (first-time load)
      loadManifest().then((m) => {
        setManifest(m);
        setManifestCards(m.cards);
        initialLoadComplete.current = true;
      });
    }

    // ALWAYS load icon from current extension's local filesystem
    // The local filesystem is the source of truth - if the extension was rebuilt
    // with a new icon, we need to load it even if there's cached state
    const loadIconFromLocalFiles = async () => {
      try {
        const result = await backendService.getLocalIcon();

        // If it's the default icon or no icon, clear any cached custom icon
        if (!result.data || result.isDefault) {
          console.log('Using default fleet icon');
          setIconState(null);
          return;
        }

        const filename = result.iconPath?.split('/').pop() || 'icon.png';
        setIconState({
          data: result.data,
          filename,
          mimeType: result.mimeType || 'image/png',
        });
        console.log('Loaded custom icon from local files:', filename);
      } catch (err) {
        console.warn('Failed to load icon from local files:', err);
      }
    };

    loadIconFromLocalFiles();
  }, []);

  // Auto-save state to localStorage when key state changes
  useEffect(() => {
    // Don't save during initial load
    if (!initialLoadComplete.current) {
      return;
    }
    saveExtensionState({
      manifest,
      manifestCards,
      cardOrder,
      dynamicCardTitles,
      iconState,
      iconHeight,
      editMode,
      editModeSnapshot,
      activeEditTab,
      timestamp: Date.now(),
    });
  }, [manifest, manifestCards, cardOrder, dynamicCardTitles, iconState, iconHeight, editMode, editModeSnapshot, activeEditTab]);

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

  // Track whether initial state loading is complete (to prevent saving during load)
  const initialLoadComplete = useRef(false);

  // Handle config loaded from external source (image or ZIP)
  const handleConfigLoaded = useCallback((loadedManifest: Manifest) => {
    // Preserve edit_mode: true when loading in edit mode (loaded manifests often have edit_mode: false)
    const manifestWithEditMode: Manifest = {
      ...loadedManifest,
      layout: {
        ...loadedManifest.layout,
        edit_mode: true,
      },
    };
    setManifest(manifestWithEditMode);
    setManifestCards(manifestWithEditMode.cards);

    // Load iconHeight from branding if present
    if (loadedManifest.branding?.iconHeight) {
      setIconHeight(loadedManifest.branding.iconHeight);
    } else {
      setIconHeight(DEFAULT_ICON_HEIGHT);
    }

    const newManifestCardIds = loadedManifest.cards
      .filter((c) => c.type !== 'gitrepo')
      .map((c) => c.id);
    const gitRepoIds = gitRepos.map((r) => `gitrepo-${r.name}`);

    setCardOrder(['fleet-status', ...newManifestCardIds, ...gitRepoIds]);
  }, [gitRepos]);

  // Handle extension title change in header
  const handleExtensionTitleChange = useCallback((title: string) => {
    setManifest((prev) => ({
      ...prev,
      app: { ...prev.app, name: title },
    }));
  }, []);

  // Handle palette change from Edit tab
  const handlePaletteChange = useCallback((newPalette: ColorPalette) => {
    setManifest((prev) => ({
      ...prev,
      branding: { ...prev.branding, palette: newPalette },
    }));
  }, []);

  // Handle icon change - auto-apply Analogous palette from icon color
  const handleIconChange = useCallback(async (newIconState: IconState) => {
    setIconState(newIconState);

    // In edit mode, when a new icon is uploaded, auto-apply Analogous palette
    if (editMode && newIconState && newIconState !== 'deleted') {
      const customIcon = newIconState as CustomIcon;
      const dataUrl = `data:${customIcon.mimeType};base64,${customIcon.data}`;

      try {
        let baseColor;
        if (isSvgMimeType(customIcon.mimeType)) {
          // Extract from SVG
          const svgContent = atob(customIcon.data);
          const colors = extractColorsFromSvg(svgContent);
          baseColor = colors[0];
        } else {
          // Extract from raster image
          baseColor = await extractDominantColor(dataUrl);
        }

        if (baseColor) {
          // Generate Analogous palette from the icon color
          const result = generatePaletteFromColor(baseColor, { harmony: 'analogous' });
          setManifest((prev) => ({
            ...prev,
            branding: { ...prev.branding, palette: result.uiPalette },
          }));
        }
      } catch (err) {
        console.error('Failed to extract color from icon:', err);
      }
    }
  }, [editMode]);

  // Open add repo dialog
  const openAddRepoDialog = useCallback(() => {
    setAddDialogOpen(true);
  }, []);

  // Handle add repo from dialog
  const handleAddRepo = useCallback(async (name: string, url: string, branch?: string) => {
    return addGitRepo(name, url, branch);
  }, [addGitRepo]);

  // Handle delete repo
  const handleDeleteRepo = useCallback(async (name: string) => {
    await deleteGitRepo(name);
  }, [deleteGitRepo]);

  // Handle edit repo
  const handleEditRepo = useCallback((repo: GitRepo) => {
    setEditingRepo(repo);
    setEditDialogOpen(true);
    // Clear the path discovery cache for this repo so it rediscovers after edit
    clearDiscoveryCache(repo.repo);
  }, [clearDiscoveryCache]);

  // Handle save edit repo
  const handleSaveEditRepo = useCallback(async (oldName: string, newName: string, url: string, branch?: string) => {
    await updateGitRepoConfig(oldName, newName, url, branch);
    setEditDialogOpen(false);
    setEditingRepo(null);
  }, [updateGitRepoConfig]);

  // Helper to get/set dynamic card title
  const getDynamicCardTitle = (cardId: string, defaultTitle: string) => {
    return dynamicCardTitles[cardId] ?? defaultTitle;
  };

  const handleDynamicTitleChange = (cardId: string) => (title: string) => {
    setDynamicCardTitles((prev) => ({ ...prev, [cardId]: title }));
  };

  // Handle showing dependency dialog
  const handleShowDependencyDialog = useCallback((gitRepoName: string, path: string, willAutoSelect: DependencyDialogState['willAutoSelect']) => {
    setDependencyDialog({ open: true, gitRepoName, path, willAutoSelect });
  }, []);

  // Handle dependency dialog confirmation
  const handleDependencyConfirm = useCallback(() => {
    const pathsToSelect = getPathsToSelect(dependencyDialog.gitRepoName, dependencyDialog.path);

    for (const [repoName, pathsToAdd] of pathsToSelect) {
      const repo = gitRepos.find((r) => r.name === repoName);
      if (!repo) continue;

      const currentPaths = repo.paths || [];
      const newPaths = [...new Set([...currentPaths, ...pathsToAdd])];

      if (newPaths.length > currentPaths.length) {
        updateGitRepoPaths(repo, newPaths);
      }
    }

    setDependencyDialog(INITIAL_DEPENDENCY_DIALOG_STATE);
  }, [dependencyDialog, gitRepos, getPathsToSelect, updateGitRepoPaths]);

  // Check if edit mode is allowed
  const editModeAllowed = manifest.layout?.edit_mode !== false;

  // Handle reset to defaults - restore default manifest, icon, icon height, and clear all repos
  const handleResetToDefaults = useCallback(async () => {
    closeResetDialog();
    handleConfigLoaded(DEFAULT_MANIFEST);
    setIconState(null);
    setIconHeight(DEFAULT_ICON_HEIGHT);
    await clearAllGitRepos();
  }, [handleConfigLoaded, clearAllGitRepos, closeResetDialog, setIconState, setIconHeight]);

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

  // Get default settings for a card type (uses registry)
  const getDefaultSettingsForCardType = (cardType: CardType): CardDefinition['settings'] => {
    return getDefaultSettingsForType(cardType);
  };

  // Convert a placeholder card to a specific type
  const convertPlaceholderCard = (cardId: string, newType: CardType) => {
    if (newType === 'gitrepo') {
      openAddRepoDialog();
      setManifestCards((prev) => prev.filter((c) => c.id !== cardId));
      setCardOrder((prev) => prev.filter((id) => id !== cardId));
    } else {
      // Get the metadata to determine the default title
      const metadata = getCardMetadata(newType);
      const defaultTitle = metadata?.label || 'New Card';

      setManifestCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, type: newType, title: defaultTitle, settings: getDefaultSettingsForCardType(newType) }
            : c
        )
      );
    }
  };

  // Render uninitialized card (no repos configured)
  const renderUninitializedCard = () => (
    <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'grey.300', boxShadow: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 2 }}>
        <Typography variant="h6" color="text.secondary">Git Repository</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          No repository configured yet.
        </Typography>
        <Button variant="contained" onClick={openAddRepoDialog} startIcon={<AddIcon />} disabled={fleetState.status !== 'running'}>
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

  // Render a manifest card (any registered card type except gitrepo)
  const renderManifestCard = (card: CardDefinition, index: number) => {
    // gitrepo is handled separately with its own rendering logic
    if (card.type === 'gitrepo') {
      return null;
    }

    // Use registry to get card component
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

    const handleDelete = () => {
      setManifestCards((prev) => prev.filter((c) => c.id !== card.id));
      setCardOrder((prev) => prev.filter((id) => id !== card.id));
    };

    const handleVisibilityToggle = () => {
      setManifestCards((prev) => {
        const next = [...prev];
        next[index] = { ...card, visible: card.visible === false ? true : false };
        return next;
      });
    };

    return {
      element: (
        <CardWrapper
          key={card.id}
          definition={card}
          editMode={editMode}
          paletteColors={palette.card}
        >
          <CardComponent
            definition={card}
            settings={card.settings || {}}
            editMode={editMode}
            onSettingsChange={handleSettingsChange}
            paletteColors={palette.card}
          />
        </CardWrapper>
      ),
      onDelete: handleDelete,
      onVisibilityToggle: handleVisibilityToggle,
      isVisible: card.visible !== false,
    };
  };

  // Render a placeholder card with type selector
  const renderPlaceholderCard = (card: CardDefinition) => {
    // Get existing card types to filter out singleton cards that already exist
    const existingTypes = manifestCards.map((c) => c.type);
    // Get card types from registry + gitrepo (special card not in registry)
    const registeredTypes = getAddCardMenuItems(existingTypes);
    const cardTypes: { type: CardType; label: string }[] = [
      ...registeredTypes,
      { type: 'gitrepo', label: 'Git Repository' },
    ];

    return (
      <Paper sx={{ p: 2, mb: 2, border: '2px dashed', borderColor: 'primary.main', boxShadow: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2, gap: 2 }}>
          <Typography variant="subtitle1" color="text.secondary">Select card type:</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
            {cardTypes.map(({ type, label }) => (
              <Button key={type} variant="outlined" size="small" onClick={() => convertPlaceholderCard(card.id, type)}>
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
        <Button size="small" startIcon={<AddIcon />} onClick={() => insertCardAfter(afterCardId)} sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}>
          Add card
        </Button>
      </Box>
    );
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

      return (
        <SortableCard key={cardId} id={cardId} editMode={editMode}>
          <CardWrapper definition={fleetStatusDef} editMode={editMode} paletteColors={palette.card}>
            <FleetStatusCard
              fleetState={fleetState}
              editMode={editMode}
              title={getDynamicCardTitle('fleet-status', 'Fleet Status')}
              repoError={repoError}
              onTitleChange={handleDynamicTitleChange('fleet-status')}
              onClearRepoError={clearRepoError}
            />
          </CardWrapper>
          {renderAddCardButton(cardId)}
        </SortableCard>
      );
    }

    // Placeholder cards
    if (cardId.startsWith('placeholder-')) {
      const card = manifestCards.find((c) => c.id === cardId);
      if (!card) return null;
      // Don't render unconverted placeholders in non-edit mode
      if (card.type === 'placeholder' && !editMode) return null;
      if (card.type !== 'placeholder') {
        if (card.visible === false && !editMode) return null;
        const index = manifestCards.indexOf(card);
        const rendered = renderManifestCard(card, index);
        if (!rendered) return null;
        const { element, onDelete, onVisibilityToggle, isVisible } = rendered;
        return (
          <SortableCard
            key={cardId}
            id={cardId}
            editMode={editMode}
            isVisible={isVisible}
            onDelete={onDelete}
            onVisibilityToggle={onVisibilityToggle}
          >
            {element}
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

      const handleRetryDiscovery = () => {
        clearDiscoveryCache(repo.repo);
        discoverPathsForRepo(repo.repo, repo.branch, true);
      };

      return (
        <SortableCard key={cardId} id={cardId} editMode={editMode}>
          <CardWrapper definition={gitRepoDef} editMode={editMode} paletteColors={palette.card}>
            <GitRepoCard
              repo={repo}
              index={repoIndex}
              maxVisiblePaths={maxVisiblePaths}
              editMode={editMode}
              title={getDynamicCardTitle(cardId, repo.name)}
              isUpdating={updatingRepo === repo.name}
              fleetRunning={fleetState.status === 'running'}
              availablePaths={repoPathsCache[repo.repo] || []}
              loadingPaths={isLoadingPaths(repo.repo)}
              hasDiscoveredPaths={repoPathsCache[repo.repo] !== undefined}
              discoveryError={discoveryErrors[repo.repo]}
              discoveryStartTime={discoveryStartTimes[repo.repo]}
              currentTime={currentTime}
              getSelectionInfo={getSelectionInfo}
              canDeselect={canDeselect}
              currentlySelectedPaths={currentlySelectedPaths}
              onTitleChange={handleDynamicTitleChange(cardId)}
              onAddRepo={openAddRepoDialog}
              onEditRepo={handleEditRepo}
              onDeleteRepo={handleDeleteRepo}
              onTogglePath={toggleRepoPath}
              onShowDependencyDialog={handleShowDependencyDialog}
              onRetryDiscovery={handleRetryDiscovery}
              onDiscoverPaths={() => discoverPathsForRepo(repo.repo, repo.branch, true)}
            />
          </CardWrapper>
          {renderAddCardButton(cardId)}
        </SortableCard>
      );
    }

    // Manifest cards (any registered card type)
    const card = manifestCards.find((c) => c.id === cardId);
    if (card && isCardTypeRegistered(card.type)) {
      if (card.visible === false && !editMode) return null;
      const index = manifestCards.indexOf(card);
      const rendered = renderManifestCard(card, index);
      if (!rendered) return null;
      const { element, onDelete, onVisibilityToggle, isVisible } = rendered;
      return (
        <SortableCard
          key={cardId}
          id={cardId}
          editMode={editMode}
          isVisible={isVisible}
          onDelete={onDelete}
          onVisibilityToggle={onVisibilityToggle}
        >
          {element}
          {renderAddCardButton(cardId)}
        </SortableCard>
      );
    }

    return null;
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: palette.body.background, display: 'flex', flexDirection: 'column' }}>
      {/* Fixed Header - striped when extension is not controlling fleet */}
      <Box sx={{
        color: palette.header.text,
        py: 0.5,
        boxShadow: 1,
        // Show striped background when not the active owner
        ...(backendStatus?.ownership?.isOwner === false ? {
          background: `repeating-linear-gradient(
            -45deg,
            ${palette.header.background},
            ${palette.header.background} 10px,
            ${alpha(palette.header.background, 0.7)} 10px,
            ${alpha(palette.header.background, 0.7)} 20px
          )`,
        } : {
          bgcolor: palette.header.background,
        }),
      }}>
        <Box sx={{ maxWidth: 900, margin: '0 auto', px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EditableHeaderIcon
              iconState={iconState}
              onChange={handleIconChange}
              editMode={editMode}
              iconHeight={iconHeight}
              onIconHeightChange={setIconHeight}
            />
            <EditableTitle
              value={manifest.app?.name || 'Fleet GitOps'}
              editMode={editMode}
              onChange={handleExtensionTitleChange}
              placeholder="Extension Name"
              variant="h6"
              validationWarning={titleWarning}
              backgroundColor={palette.header.background}
              textColor={palette.header.text}
              bold
            />
          </Box>
          {editModeAllowed && (
            editMode ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={openResetDialog}
                  startIcon={<RestoreIcon />}
                  color="warning"
                >
                  Reset
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={cancelEditMode}
                  startIcon={<CloseIcon />}
                  color="error"
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={applyEditMode}
                  startIcon={<CheckIcon />}
                  color="success"
                >
                  Apply
                </Button>
              </Box>
            ) : (
              <IconButton
                onClick={enterEditMode}
                title="Enter edit mode"
                sx={{ color: palette.header.text }}
              >
                <BuildIcon />
              </IconButton>
            )
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
              iconHeight={iconHeight}
              resolvedPalette={palette}
              onConfigLoaded={handleConfigLoaded}
              onPaletteChange={handlePaletteChange}
              onIconStateChange={setIconState}
              onIconHeightChange={setIconHeight}
              backendStatus={backendStatus}
              backendLoading={backendLoading}
              onBackendRefresh={refreshBackend}
              onTitleWarningChange={setTitleWarning}
              activeTab={activeEditTab}
              onActiveTabChange={setActiveEditTab}
              gitRepoConfigs={gitRepoConfigs}
              onClearAllGitRepos={clearAllGitRepos}
            />
          )}

          {/* Backend Status Card - debug info (only shown in development) */}
          {import.meta.env.DEV && (
            <BackendStatusCard
              status={backendStatus}
              loading={backendLoading}
              onRefresh={refreshBackend}
            />
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
      <AddRepoDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} onAdd={handleAddRepo} />

      {/* Edit Repository Dialog */}
      {editingRepo && (
        <EditRepoDialog
          open={editDialogOpen}
          currentName={editingRepo.name}
          currentUrl={editingRepo.repo}
          currentBranch={editingRepo.branch}
          onClose={() => {
            setEditDialogOpen(false);
            setEditingRepo(null);
          }}
          onSave={handleSaveEditRepo}
        />
      )}

      {/* Dependency Confirmation Dialog */}
      <DependencyConfirmationDialog
        state={dependencyDialog}
        onClose={() => setDependencyDialog(INITIAL_DEPENDENCY_DIALOG_STATE)}
        onConfirm={handleDependencyConfirm}
      />

      {/* Reset to Defaults Confirmation Dialog */}
      <ConfirmDialog
        open={confirmResetOpen}
        title="Reset to Defaults"
        message="This will reset all configuration to the default values and remove all configured Git repositories. Any unsaved changes will be lost."
        confirmLabel="Reset"
        confirmColor="warning"
        onConfirm={handleResetToDefaults}
        onCancel={closeResetDialog}
      />

    </Box>
  );
}

export default App;
