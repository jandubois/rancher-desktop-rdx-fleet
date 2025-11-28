# Fleet GitOps Extension - AI Instructions

## Project Overview

This is a **Docker Desktop / Rancher Desktop extension** that enables GitOps-based developer environment provisioning using Rancher Fleet.

**Key Technologies**: React, TypeScript, Material-UI, Docker Extension SDK, kubectl, helm, Kubernetes

## Quick Start for Development

1. **Read first**: [docs/NEXT_STEPS.md](../docs/NEXT_STEPS.md) - Current development plan and priorities
2. **Requirements**: [docs/PRD.md](../docs/PRD.md) - Product requirements and UI mockups
3. **Reference**: [docs/README.md](../docs/README.md) - Documentation index

## Key Files

| File | Purpose |
|------|---------|
| `extension/ui/src/App.tsx` | Main UI component (~1500 lines) |
| `extension/ui/src/manifest/types.ts` | Manifest and card type definitions |
| `extension/ui/src/cards/` | Card components (MarkdownCard, CardWrapper, registry) |
| `extension/Dockerfile` | Multi-stage Docker build |
| `extension/metadata.json` | Extension configuration |

## Architecture Summary

- **UI**: React + Material-UI, renders in Rancher Desktop sidebar
- **Backend**: None - all operations via kubectl/helm CLI
- **Host binaries**: Wrapper scripts in `extension/host/` delegate to `~/.rd/bin/`
- **Kubernetes context**: Always `rancher-desktop`
- **Fleet namespace**: `fleet-local`

## Card System

The UI uses a card-based architecture with drag-and-drop reordering:

- `gitrepo` - Git repository configuration with path selection
- `markdown` - Rich text content (implemented)
- `placeholder` - Temporary card for type selection in edit mode
- `auth-github`, `auth-git`, `auth-appco` - Authentication cards (not yet implemented)
- `image`, `video` - Media cards (not yet implemented)

## Current Priority

**Authentication cards** - See [docs/NEXT_STEPS.md](../docs/NEXT_STEPS.md) for details.

## Technical Decisions

- Credentials stored in Kubernetes Secrets (not extension storage)
- Path discovery uses GitHub API (not Fleet bundle inspection)
- Manifest parsing is permissive (ignores unknown fields)
- All kubectl commands use `--context rancher-desktop`
