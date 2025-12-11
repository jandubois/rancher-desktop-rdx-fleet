# Fleet GitOps Extension - Architecture Guide

This guide provides a comprehensive overview of the Fleet GitOps Extension architecture, designed to help new developers quickly understand the codebase and start contributing.

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [System Architecture](#system-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Frontend-Backend Communication](#frontend-backend-communication)
6. [Data Flow](#data-flow)
7. [Key Entry Points](#key-entry-points)
8. [Development Workflow](#development-workflow)
9. [Adding New Features](#adding-new-features)
10. [Technology Stack](#technology-stack)

---

## High-Level Overview

The Fleet GitOps Extension is a **Rancher Desktop extension** that provides a user-friendly interface for GitOps-based developer environment provisioning using [Fleet](https://fleet.rancher.io/). It enables developers to:

- Automatically install and manage Fleet on their local Kubernetes cluster
- Configure Git repositories for GitOps deployments
- Select specific paths/bundles to deploy
- Monitor deployment status in real-time

### What is Fleet?

Fleet is a GitOps-at-scale tool from Rancher that:
- Monitors Git repositories for Kubernetes manifests
- Automatically deploys changes to clusters
- Supports Helm charts, Kustomize, and raw YAML
- Uses `GitRepo` custom resources to define what to deploy

---

## System Architecture

The extension follows a **three-tier architecture**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Rancher Desktop                                      │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Frontend (React)                                   │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   Cards     │  │    Hooks    │  │  Services   │  │  Context    │  │   │
│  │  │  (UI Layer) │  │  (Logic)    │  │  (API)      │  │  (DI)       │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘  │   │
│  │         └─────────────────┴───────────────┘                          │   │
│  │                           │                                           │   │
│  └───────────────────────────┼───────────────────────────────────────────┘   │
│                              │                                               │
│            ┌─────────────────┼─────────────────┐                            │
│            │                 │                 │                            │
│            ▼                 ▼                 ▼                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Backend Service │  │   Host Scripts  │  │   Direct HTTP   │              │
│  │ (Express.js)    │  │   (CLI tools)   │  │   (GitHub API)  │              │
│  │                 │  │                 │  │                 │              │
│  │ Unix Socket     │  │ Host Execution  │  │ fetch()         │              │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────┘              │
│           │                    │                                             │
│           ▼                    ▼                                             │
│  ┌─────────────────┐  ┌─────────────────┐                                   │
│  │   K3s Cluster   │  │  Host System    │                                   │
│  │   (Kubernetes)  │  │  (Credentials)  │                                   │
│  └─────────────────┘  └─────────────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Frontend** | `extension/ui/` | React-based user interface |
| **Backend** | `extension/backend/` | Express.js service for Kubernetes operations |
| **Host Scripts** | `extension/host/` | Platform-specific CLI wrappers |
| **Metadata** | `extension/metadata.json` | Extension configuration |
| **Docker Build** | `extension/Dockerfile` | Multi-stage build for packaging |

---

## Frontend Architecture

### Directory Structure

```
extension/ui/src/
├── main.tsx                    # React entry point
├── App.tsx                     # Main application component (~850 lines)
├── types.ts                    # Core types (FleetState, GitRepo, BundleInfo)
│
├── cards/                      # Card components (UI building blocks)
│   ├── registry.ts             # Card type registry and factory
│   ├── types.ts                # Card component prop types
│   ├── CardWrapper.tsx         # Common wrapper with edit controls
│   ├── MarkdownCard.tsx        # Markdown content
│   ├── ImageCard.tsx           # Image display
│   ├── VideoCard.tsx           # Video embedding
│   ├── LinkCard.tsx            # Link collections
│   ├── DividerCard.tsx         # Visual separators
│   ├── HtmlCard.tsx            # Raw HTML content
│   ├── GitRepoCard.tsx         # Git repository configuration
│   ├── AuthGitHubCard.tsx      # GitHub authentication
│   └── AuthAppCoCard.tsx       # SUSE AppCo authentication
│
├── components/                 # Reusable UI components
│   ├── FleetStatusCard.tsx     # Fleet installation status
│   ├── GitRepoCard.tsx         # Git repo with path selection
│   ├── AddRepoDialog.tsx       # Dialog to add repositories
│   ├── EditRepoDialog.tsx      # Dialog to edit repositories
│   ├── EditModePanel.tsx       # Edit mode controls
│   ├── BackendStatusCard.tsx   # Backend health display
│   ├── PathCheckbox.tsx        # Path selection with dependencies
│   └── SortableCard.tsx        # Drag-and-drop wrapper
│
├── hooks/                      # React hooks (business logic)
│   ├── useFleetStatus.ts       # Poll Fleet status (3s/1s interval)
│   ├── useGitRepoManagement.ts # GitRepo CRUD operations
│   ├── useDependencyResolver.ts # Bundle dependency resolution
│   ├── useBackendInit.ts       # Backend connection initialization
│   ├── useBackendStatus.ts     # Backend health monitoring
│   ├── usePathDiscovery.ts     # GitHub path discovery
│   └── usePalette.ts           # Color palette generation
│
├── services/                   # Service layer (external APIs)
│   ├── BackendService.ts       # REST client for backend API
│   ├── CommandExecutor.ts      # Host CLI abstraction
│   ├── GitHubService.ts        # GitHub API client
│   ├── CredentialService.ts    # Credential helper operations
│   ├── AppCoService.ts         # SUSE AppCo API
│   ├── KubernetesService.ts    # kubectl operations (deprecated)
│   └── HttpClient.ts           # HTTP abstraction
│
├── context/                    # React context (dependency injection)
│   └── ServiceContext.tsx      # Service provider
│
├── manifest/                   # Manifest system
│   ├── types.ts                # Card types, manifest schema
│   ├── loader.ts               # Load manifest from YAML
│   └── index.ts                # Default manifest
│
├── lib/                        # Utilities
│   └── ddClient.ts             # Docker Desktop SDK client
│
├── theme/                      # Theme configuration
│   ├── index.ts                # Material-UI theme setup
│   └── palette.ts              # Color palette management
│
└── utils/                      # Utility functions
    ├── constants.ts            # Namespaces, timeouts
    ├── errors.ts               # Error handling
    ├── colorExtractor.ts       # Color extraction from images
    ├── paletteGenerator.ts     # Palette generation
    ├── extensionStateStorage.ts # localStorage persistence
    ├── extensionBuilder.ts     # Custom extension packaging
    └── cardOrdering.ts         # Card ordering utilities
```

### Key Concepts

#### Card-Based UI

The UI is composed of **draggable, reorderable cards**:

```typescript
// Card types defined in cards/types.ts
type CardType =
  | 'fleet-status'  // Fleet installation status
  | 'gitrepo'       // Git repository configuration
  | 'markdown'      // Rich text content
  | 'image'         // Static images
  | 'video'         // Embedded videos
  | 'link'          // Link collections
  | 'divider'       // Visual separators
  | 'auth-github'   // GitHub authentication
  | 'auth-appco';   // AppCo authentication
```

Cards are registered in a global registry (`cards/registry.ts`) with metadata:

```typescript
registerCard('markdown', MarkdownCard, {
  label: 'Markdown Content',
  orderable: true,
  category: 'content',
  singleton: false,
  defaultSettings: () => ({ content: '' }),
});
```

#### Manifest System

Configuration is loaded from `/ui/manifest.yaml`:

```yaml
version: "1.0"
app:
  name: "Fleet GitOps"
  icon: "/icons/fleet-icon.svg"

layout:
  show_fleet_status: true
  edit_mode: true

branding:
  header_color: "#1976d2"

cards:
  - id: github-auth
    type: auth-github
    settings:
      required: false

  - id: welcome
    type: markdown
    settings:
      content: "# Welcome to Fleet GitOps"
```

#### State Management

- **Local State**: React `useState` in components
- **Persisted State**: localStorage via `extensionStateStorage.ts`
- **Remote State**: Polled from backend via hooks
- **Service Context**: Dependency injection via React Context

---

## Backend Architecture

### Directory Structure

```
extension/backend/src/
├── index.ts                    # Express app setup, auto-install logic
│
├── routes/                     # HTTP route handlers
│   ├── health.ts               # GET /health
│   ├── identity.ts             # GET /identity
│   ├── init.ts                 # GET/POST /api/init
│   ├── fleet.ts                # Fleet status/install endpoints
│   ├── gitrepos.ts             # GitRepo CRUD endpoints
│   ├── ownership.ts            # Extension ownership
│   ├── secrets.ts              # Registry secrets
│   ├── build.ts                # Image building
│   ├── icons.ts                # Icon extraction
│   ├── debug.ts                # Debug logging
│   └── git.ts                  # Git operations
│
└── services/                   # Business logic
    ├── fleet.ts                # Fleet installation and status
    ├── gitrepos.ts             # GitRepo custom resource management
    ├── ownership.ts            # Ownership tracking
    ├── secrets.ts              # Kubernetes secrets
    ├── docker.ts               # Docker operations
    ├── build.ts                # Image building
    ├── git.ts                  # Git operations
    └── icons.ts                # Icon extraction
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/identity` | GET | Extension identity (containerId, name, version) |
| `/api/init` | GET/POST | Initialize backend, trigger Fleet install |
| `/api/fleet/status` | GET | Check Fleet status (fresh check) |
| `/api/fleet/state` | GET | Get cached Fleet state |
| `/api/fleet/install` | POST | Manually trigger Fleet installation |
| `/api/fleet/logs` | GET | Get Fleet service logs |
| `/api/gitrepos` | GET | List all GitRepos |
| `/api/gitrepos` | POST | Create/update a GitRepo |
| `/api/gitrepos/:name` | DELETE | Delete a GitRepo |
| `/api/secrets/*` | * | Registry secret management |
| `/api/build` | POST | Build custom extension image |
| `/api/icons` | POST | Extract icons from images |

### Key Services

#### FleetService (`services/fleet.ts`)

Manages Fleet installation and status:

```typescript
class FleetService {
  // Check if Fleet is installed and running
  async checkStatus(): Promise<FleetStatus>;

  // Get cached state without re-checking
  getState(): FleetState;

  // Install Fleet via HelmChart CRDs
  async ensureFleetInstalled(): Promise<void>;

  // Initialize with kubeconfig
  initialize(kubeconfig: string): void;
}
```

**Status Types:**
- `checking` - Verifying Fleet status
- `not-installed` - Fleet not found
- `installing` - Installation in progress
- `initializing` - Fleet starting up
- `running` - Fleet operational
- `error` - Something went wrong

#### GitReposService (`services/gitrepos.ts`)

Manages GitRepo custom resources:

```typescript
class GitReposService {
  // List all GitRepos in fleet-local namespace
  async listGitRepos(): Promise<GitRepo[]>;

  // Create or update a GitRepo
  async createGitRepo(repo: GitRepoSpec): Promise<void>;

  // Delete a GitRepo by name
  async deleteGitRepo(name: string): Promise<void>;

  // Get detailed status of a GitRepo
  async getGitRepoStatus(name: string): Promise<GitRepoStatus>;
}
```

### Runtime Environment

The backend runs in a Docker container with:

```yaml
# compose.yaml
services:
  backend:
    image: ${DESKTOP_PLUGIN_IMAGE}
    privileged: true
    volumes:
      # Docker socket for container operations
      - /var/run/docker.sock.raw:/var/run/docker.sock
      # K3s kubeconfig for Kubernetes access
      - /etc/rancher/k3s/k3s.yaml:/etc/rancher/k3s/k3s.yaml:ro
```

---

## Frontend-Backend Communication

### Communication Channels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                        │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Communication Methods                           │ │
│  │                                                                         │ │
│  │  1. Backend Service (Unix Socket)                                       │ │
│  │     ddClient.extension.vm.service.get('/api/fleet/state')              │ │
│  │     → Backend Express API → Kubernetes Client → K3s                    │ │
│  │                                                                         │ │
│  │  2. Host CLI Execution                                                  │ │
│  │     ddClient.extension.host.cli.exec('cred-store', [...])              │ │
│  │     → Host Scripts → Credential Helpers → Host Keychain                │ │
│  │                                                                         │ │
│  │  3. Direct HTTP (fetch)                                                 │ │
│  │     fetch('https://api.github.com/repos/...')                          │ │
│  │     → GitHub API / AppCo API                                            │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Backend Service Communication

Uses Docker Desktop SDK's `ddClient.extension.vm.service`:

```typescript
// BackendService.ts
class BackendService {
  private ddClient = createDockerDesktopClient();

  async getFleetState(): Promise<FleetState> {
    const response = await this.ddClient.extension.vm?.service?.get(
      '/api/fleet/state'
    );
    return response as FleetState;
  }

  async createGitRepo(repo: GitRepoSpec): Promise<void> {
    await this.ddClient.extension.vm?.service?.post('/api/gitrepos', repo);
  }
}
```

### Host Script Execution

Uses `ddClient.extension.host.cli.exec` for host-side operations:

```typescript
// CommandExecutor.ts
class CommandExecutor {
  async exec(command: string, args: string[]): Promise<ExecResult> {
    return await this.ddClient.extension.host?.cli.exec(command, args);
  }

  // Wrapper to use Rancher Desktop binaries from ~/.rd/bin
  async rdExec(command: string, args: string[]): Promise<ExecResult> {
    return await this.exec('rd-exec', [command, ...args]);
  }
}
```

### What Runs Where

| Operation | Location | Reason |
|-----------|----------|--------|
| Fleet status/install | Backend | Kubernetes API access |
| GitRepo CRUD | Backend | Kubernetes API access |
| Registry secrets | Backend | Kubernetes API access |
| Credential storage | Host | Access to host keychain |
| GitHub CLI (gh) | Host | Access to host gh installation |
| Helm registry auth | Host | Access to host Helm config |
| GitHub API calls | Frontend | Direct HTTP, no special access needed |

---

## Data Flow

### Fleet Status Check

```
User opens extension
        │
        ▼
┌─────────────────┐
│ useFleetStatus  │  Hook starts polling
│     hook        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ BackendService  │  backendService.getFleetState()
│ .getFleetState()│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ddClient.vm.    │  HTTP via Unix socket
│ service.get()   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Backend Route   │  /api/fleet/state
│ (fleet.ts)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ FleetService    │  Check CRDs, deployments
│ .getState()     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ @kubernetes/    │  Kubernetes client library
│ client-node     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ K3s API Server  │  /apis/fleet.cattle.io/...
└─────────────────┘
```

### GitRepo Creation

```
User clicks "Add Repository"
        │
        ▼
┌─────────────────┐
│ AddRepoDialog   │  User enters URL, branch
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ useGitRepo      │  handleAddRepo()
│ Management hook │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ BackendService  │  backendService.createGitRepo()
│ .createGitRepo()│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Backend Route   │  POST /api/gitrepos
│ (gitrepos.ts)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ GitReposService │  Creates GitRepo CR
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ K3s API Server  │  GitRepo in fleet-local namespace
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Fleet Controller│  Syncs repo, creates Bundles
└─────────────────┘
```

### Path Discovery (GitHub)

```
User enters repository URL
        │
        ▼
┌─────────────────┐
│ usePathDiscovery│  Hook triggered by URL change
│     hook        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ GitHubService   │  fetchGitHubPaths()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ fetch() →       │  GET /repos/:owner/:repo/git/trees/:sha
│ GitHub API      │  Recursive tree lookup
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Parse tree      │  Find fleet.yaml files
│ Find paths      │  Extract dependsOn
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PathInfo[]      │  { path, hasDependencies, dependencies }
└─────────────────┘
```

---

## Key Entry Points

### Frontend

| File | Purpose | Start Here When... |
|------|---------|-------------------|
| `ui/src/main.tsx` | React app initialization | Understanding app bootstrap |
| `ui/src/App.tsx` | Main component, card rendering | Understanding overall UI |
| `ui/src/hooks/useFleetStatus.ts` | Fleet status polling | Debugging status issues |
| `ui/src/hooks/useGitRepoManagement.ts` | GitRepo operations | Debugging repo issues |
| `ui/src/services/BackendService.ts` | Backend API client | Understanding API calls |
| `ui/src/cards/registry.ts` | Card registration | Adding new card types |

### Backend

| File | Purpose | Start Here When... |
|------|---------|-------------------|
| `backend/src/index.ts` | Express app setup | Understanding backend bootstrap |
| `backend/src/services/fleet.ts` | Fleet management | Debugging Fleet issues |
| `backend/src/services/gitrepos.ts` | GitRepo management | Debugging GitRepo issues |
| `backend/src/routes/fleet.ts` | Fleet API routes | Adding Fleet endpoints |
| `backend/src/routes/gitrepos.ts` | GitRepo API routes | Adding GitRepo endpoints |

### Configuration

| File | Purpose |
|------|---------|
| `extension/metadata.json` | Extension manifest (UI, backend, host binaries) |
| `extension/compose.yaml` | Backend container configuration |
| `extension/Dockerfile` | Multi-stage build definition |
| `ui/manifest.yaml` | UI configuration (cards, branding) |

---

## Development Workflow

### Prerequisites

- Rancher Desktop (with Kubernetes enabled)
- Node.js 22+
- Docker

### Quick Start

```bash
# Clone the repository
git clone https://github.com/jandubois/rancher-desktop-rdx-fleet.git
cd rancher-desktop-rdx-fleet

# Build and install the extension
cd extension
docker build -t fleet-extension:dev .
docker extension install fleet-extension:dev
```

### Frontend Development (Hot Reload)

```bash
# Terminal 1: Start Vite dev server
cd extension/ui
npm install
npm run dev  # Starts on http://localhost:3000

# Terminal 2: Enable dev mode
docker extension dev ui-source fleet-extension:dev http://localhost:3000
```

### Backend Development

```bash
# Make changes to backend/src/...
# Rebuild and reinstall
cd extension
docker extension rm fleet-extension:dev
docker build -t fleet-extension:dev .
docker extension install fleet-extension:dev
```

### Running Tests

```bash
# Frontend tests (Vitest)
cd extension/ui
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:e2e      # Playwright E2E tests

# Backend tests (Jest)
cd extension/backend
npm test              # Run once
npm run test:watch    # Watch mode

# Linting
npm run lint          # Both frontend and backend
```

### Viewing Logs

```bash
# Extension backend logs
docker logs <extension-container-id>

# Find container ID
docker ps --filter "name=fleet"
```

---

## Adding New Features

### Adding a New Card Type

1. **Create the card component** in `ui/src/cards/`:

```typescript
// ui/src/cards/MyNewCard.tsx
import { CardWrapper, CardProps } from './CardWrapper';
import { registerCard } from './registry';

interface MyNewCardSettings {
  myOption: string;
}

export function MyNewCard({ card, editMode, onDelete }: CardProps) {
  const settings = card.settings as MyNewCardSettings;

  return (
    <CardWrapper title={card.title} editMode={editMode} onDelete={onDelete}>
      <Typography>{settings.myOption}</Typography>
    </CardWrapper>
  );
}

// Register the card
registerCard('my-new-card', MyNewCard, {
  label: 'My New Card',
  orderable: true,
  category: 'content',
  defaultSettings: () => ({ myOption: 'default' }),
});
```

2. **Add the type** to `ui/src/cards/types.ts`:

```typescript
export type CardType =
  | 'markdown'
  | 'my-new-card'  // Add here
  // ...
```

3. **Import in registry** (`ui/src/cards/index.ts`):

```typescript
export * from './MyNewCard';
```

### Adding a New Backend Endpoint

1. **Create route handler** in `backend/src/routes/`:

```typescript
// backend/src/routes/myfeature.ts
import { Router } from 'express';
import { MyFeatureService } from '../services/myfeature';

const router = Router();
const service = new MyFeatureService();

router.get('/api/myfeature', async (req, res) => {
  try {
    const result = await service.getData();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

2. **Create service** in `backend/src/services/`:

```typescript
// backend/src/services/myfeature.ts
export class MyFeatureService {
  async getData(): Promise<MyData> {
    // Implementation
  }
}
```

3. **Register route** in `backend/src/index.ts`:

```typescript
import myfeatureRouter from './routes/myfeature';
app.use(myfeatureRouter);
```

4. **Add frontend method** in `ui/src/services/BackendService.ts`:

```typescript
async getMyFeatureData(): Promise<MyData> {
  const response = await this.ddClient.extension.vm?.service?.get(
    '/api/myfeature'
  );
  return response as MyData;
}
```

### Adding a Host Script

1. **Create scripts** for each platform in `extension/host/`:

```bash
# extension/host/linux/my-script
#!/bin/bash
source "$(dirname "$0")/rd-exec"
# Your script logic

# extension/host/darwin/my-script  (same content)

# extension/host/windows/my-script.cmd
@echo off
"%~dp0rd-exec.cmd" %*
```

2. **Register in metadata.json**:

```json
{
  "host": {
    "binaries": [
      {
        "darwin": [{ "path": "/host/darwin/my-script" }],
        "linux": [{ "path": "/host/linux/my-script" }],
        "windows": [{ "path": "/host/windows/my-script.cmd" }]
      }
    ]
  }
}
```

3. **Use from frontend**:

```typescript
await ddClient.extension.host?.cli.exec('my-script', ['arg1', 'arg2']);
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI framework |
| TypeScript | 5.3 | Type safety |
| Vite | 7.x | Build tool |
| Material-UI (MUI) | 7.x | Component library |
| @dnd-kit | 6.x/8.x | Drag-and-drop |
| Vitest | 4.x | Unit testing |
| Playwright | 1.56 | E2E testing |
| Emotion | - | CSS-in-JS (via MUI) |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 22 | Runtime |
| Express | 4.21 | Web framework |
| TypeScript | 5.6 | Type safety |
| @kubernetes/client-node | 0.22 | Kubernetes API client |
| Dockerode | 4.x | Docker API client |
| Jest | 29.x | Testing |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| Docker | Container runtime |
| K3s | Kubernetes distribution (via Rancher Desktop) |
| Fleet | GitOps engine |
| Helm Controller | HelmChart CRD processing |

---

## Further Reading

- [UI Card Architecture](reference/ui-card-architecture.md) - Detailed card system documentation
- [Extension Architecture](reference/extension-architecture.md) - Docker/Rancher Desktop SDK details
- [Fleet Local Mode](reference/fleet-local-mode.md) - Fleet configuration and GitRepo CRD
- [Architecture Review](ARCHITECTURE_REVIEW.md) - Known issues and refactoring recommendations
- [Card Types Reference](user-guide/card-types.md) - YAML configuration for all card types
