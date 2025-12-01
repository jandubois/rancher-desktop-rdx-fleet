import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import EditOffIcon from '@mui/icons-material/EditOff';
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

function App() {
  // Get services from context
  const { kubernetesService, gitHubService } = useServices();

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
    const manifestCardIds = manifestCards
      .filter((c) => c.type === 'markdown' || c.type === 'html' || c.type === 'image' || c.type === 'video' || c.type === 'link' || c.type === 'divider' || c.type === 'placeholder')
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

  // Render a manifest card (markdown, image, etc.)
  const renderManifestCard = (card: CardDefinition, index: number) => {
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
          paletteColors={palette.card}
        />
      </CardWrapper>
    );
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

    // Manifest cards (markdown, html, image, video, link, divider)
    const card = manifestCards.find((c) => c.id === cardId);
    if (card && (card.type === 'markdown' || card.type === 'html' || card.type === 'image' || card.type === 'video' || card.type === 'link' || card.type === 'divider')) {
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
