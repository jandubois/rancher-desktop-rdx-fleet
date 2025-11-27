# Fleet Local Mode for Single-Cluster Deployments

This document describes how to use Fleet in "local mode" for single-cluster deployments, where the same cluster runs both the Fleet controller and deploys workloads. This is the primary mode for the Fleet extension in Rancher Desktop.

## Overview

Fleet is designed as a hub-and-spoke GitOps platform, but it also supports a **single-cluster mode** where:
- The Fleet controller runs on the local cluster
- GitRepo resources are created in the `fleet-local` namespace
- No cluster registration is required
- Deployments happen directly on the same cluster

This is ideal for developer workstations running Rancher Desktop or Docker Desktop with Kubernetes.

## Architecture: Local vs Multi-Cluster

### Multi-Cluster (Standard Fleet)
```
Management Cluster                     Downstream Clusters
┌─────────────────────┐               ┌──────────────────┐
│ Fleet Controller    │──────────────▶│ Fleet Agent      │
│ cattle-fleet-system │               │ cattle-fleet-system
│                     │               └──────────────────┘
│ GitRepo (fleet-*)   │               ┌──────────────────┐
│ Bundle              │──────────────▶│ Fleet Agent      │
│ BundleDeployment    │               └──────────────────┘
└─────────────────────┘
```

### Single-Cluster (Local Mode)
```
Local Cluster (e.g., Rancher Desktop)
┌──────────────────────────────────────────┐
│  cattle-fleet-system namespace           │
│  ├── Fleet Controller                    │
│  └── Fleet Agent (local)                 │
│                                          │
│  fleet-local namespace                   │
│  ├── GitRepo resources                   │
│  ├── Bundle resources                    │
│  └── BundleDeployment resources          │
│                                          │
│  (target namespaces)                     │
│  └── Deployed applications               │
└──────────────────────────────────────────┘
```

## Key Namespaces

| Namespace | Purpose |
|-----------|---------|
| `cattle-fleet-system` | Fleet controller and CRDs |
| `fleet-local` | GitRepo/Bundle resources for local deployments |
| `cattle-fleet-local-system` | Internal Fleet local agent namespace |

## Installation for Local Mode

### Install Fleet CRDs and Controller

```bash
# Add Fleet Helm repository
helm repo add fleet https://rancher.github.io/fleet-helm-charts/

# Install CRDs
helm install --create-namespace -n cattle-fleet-system --wait \
    fleet-crd fleet/fleet-crd

# Install Fleet controller
helm install --create-namespace -n cattle-fleet-system --wait \
    fleet fleet/fleet
```

Fleet automatically creates a local cluster representation, so no additional agent installation is needed.

## GitRepo Custom Resource

The `GitRepo` CRD is the primary interface for users. It defines a Git repository to monitor and deploy.

### GitRepo Specification

```yaml
apiVersion: fleet.cattle.io/v1alpha1
kind: GitRepo
metadata:
  name: my-apps
  namespace: fleet-local    # Important: use fleet-local for local deployments
spec:
  # Git repository URL (required)
  repo: https://github.com/myorg/fleet-config

  # Branch, tag, or commit to track
  branch: main
  # revision: v1.0.0  # Or specific tag/commit

  # Paths within the repo to process (default: ["/"])
  paths:
    - /apps
    - /infrastructure

  # Polling interval (default: 15s)
  pollingInterval: 5m

  # Authentication (optional)
  clientSecretName: git-credentials  # Secret with username/password or SSH key

  # TLS configuration (optional)
  insecureSkipTLSVerify: false
  caBundle: ""  # Base64-encoded CA certificate

  # Target clusters (for local mode, usually not needed)
  # targets:
  #   - clusterSelector: {}  # All clusters (just local in this case)
```

### GitRepo Status

```yaml
status:
  # Current commit being deployed
  commit: abc123def456

  # Overall deployment state
  desiredReadyClusters: 1
  readyClusters: 1

  # Bundle summary
  display:
    readyBundleDeployments: 3/3
    state: Active

  # Conditions
  conditions:
    - type: Ready
      status: "True"
    - type: Reconciling
      status: "False"
```

## Repository Structure (fleet.yaml)

Fleet processes repositories using optional `fleet.yaml` configuration files.

### Basic Structure

```
my-fleet-repo/
├── fleet.yaml              # Optional: repo-wide configuration
├── apps/
│   ├── fleet.yaml          # Optional: path-specific config
│   ├── nginx/
│   │   ├── fleet.yaml      # App-specific config
│   │   └── deployment.yaml
│   └── redis/
│       └── Chart.yaml      # Helm chart (auto-detected)
└── infrastructure/
    └── cert-manager/
        └── kustomization.yaml  # Kustomize (auto-detected)
```

### fleet.yaml Options

```yaml
# Deployment options
defaultNamespace: my-namespace   # Target namespace for resources
targetNamespace: my-namespace    # Alias for defaultNamespace

# Helm chart configuration
helm:
  releaseName: my-release
  chart: ./chart               # Path to local chart, or:
  repo: https://charts.example.com
  version: "1.0.0"
  values:
    key: value
  valuesFiles:
    - values.yaml
    - values-prod.yaml

# Kustomize configuration
kustomize:
  dir: ./overlays/production

# Raw YAML options
yaml:
  overlays:
    - production

# Target selection (for multi-cluster, usually not needed in local mode)
targets:
  - name: local
    clusterSelector: {}
```

## Bundle and BundleDeployment

When Fleet processes a GitRepo, it creates:

1. **Bundle**: Packages the processed Kubernetes resources
2. **BundleDeployment**: Represents the deployment to a specific cluster

### Viewing Bundles

```bash
# List all bundles
kubectl get bundles -n fleet-local

# Describe a specific bundle
kubectl describe bundle my-apps-nginx -n fleet-local
```

### Viewing BundleDeployments

```bash
# List bundle deployments
kubectl get bundledeployments -n fleet-local

# Check deployment status
kubectl get bundledeployments -n fleet-local -o wide
```

## Content Types Supported

Fleet auto-detects and supports multiple content types:

| Type | Detection | Processing |
|------|-----------|------------|
| **Helm Chart** | `Chart.yaml` present | Rendered via `helm template`, deployed via Helm |
| **Kustomize** | `kustomization.yaml` present | Processed via `kustomize build` |
| **Raw YAML** | `.yaml`/`.yml` files | Applied directly |

All content is ultimately deployed through Helm releases for consistent lifecycle management.

## Authentication for Private Repositories

### HTTP/HTTPS Basic Auth

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: git-credentials
  namespace: fleet-local
type: Opaque
data:
  username: <base64-encoded>
  password: <base64-encoded>  # Can be a personal access token
```

### SSH Key

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: git-ssh-key
  namespace: fleet-local
type: Opaque
data:
  ssh-privatekey: <base64-encoded-private-key>
  # known_hosts: <base64-encoded>  # Optional
```

Reference in GitRepo:

```yaml
spec:
  repo: git@github.com:myorg/private-repo.git
  clientSecretName: git-ssh-key
```

## Polling vs Webhooks

### Polling (Default)

Fleet polls Git repositories at regular intervals:

```yaml
spec:
  pollingInterval: 5m  # Default: 15s
```

### Webhooks (Advanced)

For faster updates, configure webhooks in your Git provider to POST to:
```
https://<fleet-webhook-endpoint>/v1/webhook
```

Supported providers: GitHub, GitLab, Bitbucket, Azure DevOps, Gogs

## Useful Commands

```bash
# Check Fleet controller status
kubectl get pods -n cattle-fleet-system

# View GitRepo status
kubectl get gitrepos -n fleet-local

# Watch bundle deployments
kubectl get bundledeployments -n fleet-local -w

# Force resync a GitRepo
kubectl patch gitrepo my-apps -n fleet-local \
  --type=merge -p '{"spec":{"forceSyncGeneration":1}}'

# Pause a GitRepo (stop syncing)
kubectl patch gitrepo my-apps -n fleet-local \
  --type=merge -p '{"spec":{"paused":true}}'

# View deployed Helm releases (created by Fleet)
helm list -A
```

## Integration with Fleet Extension

For the Rancher Desktop Fleet extension, the typical workflow is:

1. **Extension installs Fleet** (CRDs + controller) if not present
2. **User provides Git repo URL** via UI
3. **Extension creates GitRepo CR** in `fleet-local` namespace
4. **Fleet syncs and deploys** the content
5. **Extension displays status** by watching GitRepo/Bundle/BundleDeployment

### Creating GitRepo Programmatically

```typescript
// Using kubectl from the extension
const gitRepoYaml = `
apiVersion: fleet.cattle.io/v1alpha1
kind: GitRepo
metadata:
  name: ${repoName}
  namespace: fleet-local
spec:
  repo: ${repoUrl}
  branch: ${branch}
  paths: ${JSON.stringify(paths)}
`;

await ddClient.extension.host?.cli.exec("kubectl", [
  "apply", "-f", "-"
], {
  stdin: gitRepoYaml
});
```

### Monitoring Status

```typescript
// Watch GitRepo status
const result = await ddClient.extension.host?.cli.exec("kubectl", [
  "get", "gitrepo", repoName,
  "-n", "fleet-local",
  "-o", "json"
]);

const gitRepo = JSON.parse(result?.stdout || "{}");
const status = gitRepo.status;

// Check readiness
const isReady = status?.conditions?.find(c => c.type === "Ready")?.status === "True";
const commit = status?.commit;
const bundleCount = status?.display?.readyBundleDeployments;
```

## Example: Enterprise Developer Setup

A typical enterprise use case for the Fleet extension:

```yaml
# Enterprise GitRepo configuration
apiVersion: fleet.cattle.io/v1alpha1
kind: GitRepo
metadata:
  name: acme-developer-setup
  namespace: fleet-local
spec:
  repo: https://github.com/acme-corp/developer-baseline
  branch: main
  paths:
    - /common-tools        # kubectl plugins, CLI tools
    - /observability       # Prometheus, Grafana configs
    - /security-policies   # NetworkPolicies, PodSecurityPolicies
    - /team-namespaces     # Developer namespace setup
  pollingInterval: 30m     # Check for updates every 30 min
```

The repository contains standard developer environment configurations that are automatically applied when the extension is configured.

## Sources

- Fleet Wiki: `docs/background/wiki/rancher/fleet/`
- Fleet Overview: `docs/background/wiki/rancher/fleet/1-overview.md`
- Fleet Architecture: `docs/background/wiki/rancher/fleet/2-architecture.md`
- GitOps System: `docs/background/wiki/rancher/fleet/7-gitops-system.md`
- Core APIs: `docs/background/wiki/rancher/fleet/3-core-apis-and-custom-resources.md`
