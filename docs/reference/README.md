# Reference Documentation

This directory contains curated reference documents for implementing the Fleet extension for Rancher Desktop. These documents are synthesized from the background materials in `docs/background/`.

## Documents

| Document | Description | Key Topics |
|----------|-------------|------------|
| [extension-architecture.md](extension-architecture.md) | Docker/Rancher Desktop extension structure | metadata.json, multi-tier architecture, host binaries, SDK APIs |
| [fleet-local-mode.md](fleet-local-mode.md) | Using Fleet for single-cluster deployments | fleet-local namespace, GitRepo CRD, no cluster registration |
| [helm-controller-integration.md](helm-controller-integration.md) | Declarative Helm chart management via CRD | HelmChart/HelmChartConfig resources, alternative to Fleet |
| [bundle-dependencies.md](bundle-dependencies.md) | Bundle naming and dependency resolution | dependsOn field, bundle naming convention, resolution algorithm |
| [ui-card-architecture.md](ui-card-architecture.md) | Card-based UI system (developer reference) | Drag-and-drop, manifest-driven cards, edit mode, path discovery |

## User Documentation

For end-user documentation on configuring and using the extension, see the **[User Guide](../user-guide/README.md)**.

## Usage

These documents are designed to be the primary reference during implementation. The full background materials in `docs/background/` can be consulted for deeper details when needed.

## Quick Reference

### Extension Structure
```
extension/
├── Dockerfile          # Multi-stage build
├── metadata.json       # Extension config
├── ui/                 # React frontend
├── backend/            # Express.js service
└── icons/              # Visual assets
```

### Fleet Local Deployment
```yaml
apiVersion: fleet.cattle.io/v1alpha1
kind: GitRepo
metadata:
  name: my-config
  namespace: fleet-local    # Key: use fleet-local namespace
spec:
  repo: https://github.com/org/repo
  branch: main
  paths: ["/"]
```

### Key SDKs/APIs
- `@docker/extension-api-client` - Docker Desktop Client SDK
- `ddClient.extension.host?.cli.exec()` - Run host binaries
- `ddClient.extension.vm?.service` - Backend HTTP calls
- `kubectl` - Shipped as host binary for K8s operations
