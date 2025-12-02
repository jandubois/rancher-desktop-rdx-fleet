import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
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
import { loadExtensionState, saveExtensionState, PersistedExtensionState } from './utils/extensionStateStorage';

// Get initial state from localStorage (synchronous for lazy useState)
function getInitialState(): PersistedExtensionState | null {
  try {
    return loadExtensionState();
  } catch {
    return null;
  }
}

import type { ColorPalette } from './theme';
import { CardWrapper, getCardComponent, getAddCardMenuItems, getDefaultSettingsForType, isCardTypeRegistered } from './cards';
import {
  SortableCard,
  AddRepoDialog,
  EditableTitle,
  EditModePanel,
  EditableHeaderIcon,
  IconState,
  GitRepoCard,
  FleetStatusCard,
  DependencyConfirmationDialog,
  INITIAL_DEPENDENCY_DIALOG_STATE,
  DependencyDialogState,
} from './components';
import { useFleetStatus, useGitRepoManagement, usePalette, usePathDiscovery, useDependencyResolver } from './hooks';
import { useServices } from './context';

// Cache the initial state load so all useState initializers see the same value
const cachedInitialState = getInitialState();

function App() {
  // Get services from context
  const { kubernetesService, gitHubService } = useServices();

  // Manifest and edit mode state - prefer cached state from localStorage
  const [manifest, setManifest] = useState<Manifest>(
    () => cachedInitialState?.manifest ?? DEFAULT_MANIFEST
  );
  const [editMode, setEditMode] = useState(false);
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

  // Icon state for extension builder: null = default, CustomIcon = custom, 'deleted' = no icon
  const [iconState, setIconState] = useState<IconState>(
    () => cachedInitialState?.iconState ?? null
  );

  // Edit mode snapshot for undo/cancel functionality
  const [editModeSnapshot, setEditModeSnapshot] = useState<{
    manifest: Manifest;
    manifestCards: CardDefinition[];
    cardOrder: string[];
    iconState: IconState;
    dynamicCardTitles: Record<string, string>;
  } | null>(null);

  // Add repo dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);

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

  // Fleet status hook with injected service
  const {
    fleetState,
    installing,
    installFleet,
  } = useFleetStatus({
    kubernetesService,
    onFleetReady: () => {
      fetchGitRepos();
    },
  });

  // GitRepo management hook with injected service
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
    kubernetesService,
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
    // Use registry to determine which card types are orderable
    const manifestCardIds = manifestCards
      .filter((c) => isCardTypeRegistered(c.type) || c.type === 'placeholder')
      .map((c) => c.id);
    const allValidIds = new Set(['fleet-status', ...gitRepoIds, ...manifestCardIds]);

    // Filter out deleted cards from user's preferred order
    const filtered = cardOrder.filter((id) => allValidIds.has(id));

    // Add new cards that aren't in the order yet
    const existingIds = new Set(filtered);
    const newIds = [...allValidIds].filter((id) => !existingIds.has(id));

    return [...filtered, ...newIds];
  }, [cardOrder, gitRepos, manifestCards]);

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
      timestamp: Date.now(),
    });
  }, [manifest, manifestCards, cardOrder, dynamicCardTitles, iconState]);

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
    setManifest(loadedManifest);
    setManifestCards(loadedManifest.cards);

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

  // Handle entering edit mode - save snapshot for undo
  const handleEnterEditMode = useCallback(() => {
    setEditModeSnapshot({
      manifest,
      manifestCards,
      cardOrder,
      iconState,
      dynamicCardTitles,
    });
    setEditMode(true);
  }, [manifest, manifestCards, cardOrder, iconState, dynamicCardTitles]);

  // Handle applying edit mode changes - clear snapshot and exit
  const handleApplyEditMode = useCallback(() => {
    setManifestCards((prev) => prev.filter((c) => c.type !== 'placeholder'));
    setEditModeSnapshot(null);
    setEditMode(false);
  }, []);

  // Handle canceling edit mode - restore snapshot and exit
  const handleCancelEditMode = useCallback(() => {
    if (editModeSnapshot) {
      setManifest(editModeSnapshot.manifest);
      setManifestCards(editModeSnapshot.manifestCards);
      setCardOrder(editModeSnapshot.cardOrder);
      setIconState(editModeSnapshot.iconState);
      setDynamicCardTitles(editModeSnapshot.dynamicCardTitles);
    }
    setEditModeSnapshot(null);
    setEditMode(false);
  }, [editModeSnapshot]);

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
      setManifestCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, type: newType, settings: getDefaultSettingsForCardType(newType) }
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
    // Get card types from registry + gitrepo (special card not in registry)
    const registeredTypes = getAddCardMenuItems();
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
              installing={installing}
              editMode={editMode}
              title={getDynamicCardTitle('fleet-status', 'Fleet Status')}
              repoError={repoError}
              onTitleChange={handleDynamicTitleChange('fleet-status')}
              onInstallFleet={installFleet}
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
              totalCount={gitRepos.length}
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
      {/* Fixed Header */}
      <Box sx={{ bgcolor: palette.header.background, color: palette.header.text, py: 2, boxShadow: 1 }}>
        <Box sx={{ maxWidth: 900, margin: '0 auto', px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EditableHeaderIcon iconState={iconState} onChange={setIconState} editMode={editMode} />
            <EditableTitle
              value={manifest.app?.name || 'Fleet GitOps'}
              editMode={editMode}
              onChange={handleExtensionTitleChange}
              placeholder="Extension Name"
              variant="h6"
            />
          </Box>
          {editModeAllowed && (
            editMode ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleCancelEditMode}
                  startIcon={<CloseIcon />}
                  color="error"
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleApplyEditMode}
                  startIcon={<CheckIcon />}
                  color="success"
                >
                  Apply
                </Button>
              </Box>
            ) : (
              <IconButton
                onClick={handleEnterEditMode}
                title="Enter edit mode"
                sx={{ color: palette.header.text }}
              >
                <EditIcon />
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
              resolvedPalette={palette}
              onConfigLoaded={handleConfigLoaded}
              onPaletteChange={handlePaletteChange}
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

      {/* Dependency Confirmation Dialog */}
      <DependencyConfirmationDialog
        state={dependencyDialog}
        onClose={() => setDependencyDialog(INITIAL_DEPENDENCY_DIALOG_STATE)}
        onConfirm={handleDependencyConfirm}
      />
    </Box>
  );
}

export default App;
