# Claude Code Instructions

## STOP - Read Documentation First

**DO NOT** start by running Glob, Grep, or other exploration commands.

This project has comprehensive documentation. Read it first:

1. **Current priorities**: `docs/NEXT_STEPS.md` - What to work on and key file locations
2. **Project context**: `.claude/instructions.md` - Architecture, key files, technical decisions
3. **Reference docs**: `docs/reference/` - Detailed implementation guides

## Quick Orientation

| What you need | Where to find it |
|---------------|------------------|
| What to work on next | `docs/NEXT_STEPS.md` |
| Key file locations | `docs/NEXT_STEPS.md` (Key Files Reference section) |
| Architecture overview | `.claude/instructions.md` |
| UI card system | `docs/reference/ui-card-architecture.md` |
| Fleet integration | `docs/reference/fleet-local-mode.md` |
| Extension SDK | `docs/reference/extension-architecture.md` |

## Project Structure

```
extension/
├── ui/src/
│   ├── App.tsx              # Main component
│   ├── types.ts             # Shared types
│   ├── hooks/               # Business logic (Fleet, GitRepo, paths)
│   ├── components/          # UI components
│   ├── cards/               # Card system (registry, types)
│   └── manifest/            # Manifest loader and types
├── host/                    # kubectl/helm wrappers
├── Dockerfile
└── metadata.json

docs/
├── NEXT_STEPS.md            # READ FIRST - priorities & key files
├── PRD.md                   # Product requirements
├── reference/               # Implementation guides
└── background/              # External reference materials
```

## Key Technical Facts

- **Kubernetes context**: Always `rancher-desktop`
- **Fleet namespace**: `fleet-local`
- **No backend service**: All operations via kubectl/helm CLI
- **Card-based UI**: Manifest-driven, drag-and-drop reorderable

## When You Must Explore

If documentation doesn't answer your question:
1. Check `docs/reference/` for the relevant topic
2. Check `docs/background/` for external API/SDK docs
3. Only then use targeted Glob/Grep for specific files
