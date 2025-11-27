# Background Documents

This directory contains reference information collected from the internet for implementing the Fleet extension. For curated, implementation-focused documentation, see [`docs/reference/`](../reference/).

## Quick Links

| Topic | Primary Resource |
|-------|-----------------|
| Extension Architecture | [wiki/rancherlabs/application-collection-extension/](wiki/rancherlabs/application-collection-extension/1-overview.md) |
| Fleet GitOps | [wiki/rancher/fleet/](wiki/rancher/fleet/1-overview.md) |
| Helm Controller | [wiki/k3s-io/helm-controller/](wiki/k3s-io/helm-controller/1-overview.md) |
| Docker SDK | [docker-extensions/extensions-sdk/](docker-extensions/extensions-sdk/quickstart.md) |

## Directory Structure

```
docs/background/
├── README.md                 # This file
├── k3s-helm-controller.md    # K3s official Helm docs
├── spark-app-guide.md        # UI design guidelines
│
├── wiki/                     # DeepWiki summaries (primary reference)
│   ├── rancher/fleet/        # Fleet architecture & APIs
│   ├── rancherlabs/application-collection-extension/  # Blueprint extension
│   └── k3s-io/helm-controller/  # Helm Controller CRDs
│
├── docker-extensions/        # Docker Extensions SDK docs
│   └── extensions-sdk/
│       ├── architecture/     # Extension structure
│       ├── build/            # Build tutorials
│       ├── dev/              # SDK APIs
│       └── guides/           # Kubernetes, host binaries
│
├── appco-help/               # AppCo user documentation
│   └── get-started/          # Authentication, first steps
│
└── archive/                  # Archived (regeneratable) content
    ├── fleet-repo.txt        # Full Fleet repo dump
    ├── fleet-docs-repo.txt   # Fleet docs repo
    ├── appco-repo.txt        # AppCo extension repo
    ├── docker-extensions-sdk-repo.txt
    ├── helm-controller-repo.txt
    └── scripts/              # Scripts used to generate docs
```

## Content Overview

### DeepWiki Summaries (Recommended)

Well-organized summaries generated from source repositories:

- **Fleet** (`wiki/rancher/fleet/`): GitOps system, GitRepo CRD, Bundle management
- **AppCo Extension** (`wiki/rancherlabs/application-collection-extension/`): Blueprint for our extension
- **Helm Controller** (`wiki/k3s-io/helm-controller/`): HelmChart/HelmChartConfig CRDs

### Docker Extensions SDK

Essential documentation for building Docker Desktop/Rancher Desktop extensions:

- `extensions-sdk/architecture/` - Extension metadata, security model
- `extensions-sdk/build/` - Frontend and backend tutorials
- `extensions-sdk/dev/api/` - SDK API reference
- `extensions-sdk/guides/kubernetes.md` - K8s integration
- `extensions-sdk/guides/invoke-host-binaries.md` - Running CLI tools

### Other Resources

- `k3s-helm-controller.md` - Official K3s Helm Controller documentation
- `spark-app-guide.md` - UI design principles and coding standards
- `appco-help/get-started/` - AppCo authentication and setup

### Archived Content

Large repository dumps moved to `archive/` - only needed for specific code lookups:

- `fleet-repo.txt` (2.1MB) - Full Fleet source
- `fleet-docs-repo.txt` (385KB) - Fleet documentation
- `appco-repo.txt` (168KB) - AppCo extension source
- `docker-extensions-sdk-repo.txt` (71KB) - Docker SDK source
- `helm-controller-repo.txt` (76KB) - Helm Controller source

## See Also

- [`docs/reference/`](../reference/) - Curated implementation guides
- [`docs/reference/extension-architecture.md`](../reference/extension-architecture.md) - Extension structure
- [`docs/reference/fleet-local-mode.md`](../reference/fleet-local-mode.md) - Fleet single-cluster usage
- [`docs/reference/helm-controller-integration.md`](../reference/helm-controller-integration.md) - Helm CRDs
