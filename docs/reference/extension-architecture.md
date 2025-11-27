# Docker Desktop / Rancher Desktop Extension Architecture

This document provides a curated reference for building extensions compatible with Docker Desktop and Rancher Desktop. It synthesizes information from the Docker Extensions SDK and the AppCo extension (our blueprint).

## Overview

Docker Desktop Extensions are packaged as Docker images that contain:
- A **UI layer** (React/TypeScript frontend)
- An optional **backend service** (runs in the Docker VM)
- Optional **host binaries** (CLI tools deployed to the user's machine)

Rancher Desktop supports the same extension mechanism.

## Extension Image Structure

An extension image must contain a `metadata.json` file at the root of its filesystem:

```json
{
    "icon": "extension-icon.svg",
    "ui": {
        "dashboard-tab": {
            "title": "My Extension",
            "root": "/ui",
            "src": "index.html"
        }
    },
    "vm": {
        "image": "${DESKTOP_PLUGIN_IMAGE}"
    },
    "host": {
        "binaries": [
            {
                "darwin": [{ "path": "/darwin/kubectl" }],
                "linux": [{ "path": "/linux/kubectl" }],
                "windows": [{ "path": "/windows/kubectl.exe" }]
            }
        ]
    }
}
```

### Sections

| Section | Purpose | Required |
|---------|---------|----------|
| `ui` | Defines the dashboard tab (frontend) | Optional |
| `vm` | Backend service running in Docker VM | Optional |
| `host` | Binaries to deploy to host machine | Optional |

## Three-Tier Architecture (AppCo Pattern)

The recommended architecture follows a three-tier pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Desktop UI                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              React Frontend (ui/)                    │   │
│  │  - Material-UI components                            │   │
│  │  - Hash-based routing (createHashRouter)             │   │
│  │  - Docker Desktop Client SDK                         │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │           Express.js Backend (backend/)              │   │
│  │  - Runs on Unix socket in VM                         │   │
│  │  - YAML processing, API orchestration                │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │              CLI Tools (host binaries)               │   │
│  │  - kubectl, helm                                     │   │
│  │  - Deployed to host, invoked via SDK                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Layer

### Technology Stack
- **React** with TypeScript
- **Material-UI** for components
- **Vite** for bundling
- **Hash-based routing** (`createHashRouter` from react-router-dom)

### Docker Desktop Client SDK

The SDK provides the `ddClient` object for interacting with Docker Desktop:

```typescript
import { createDockerDesktopClient } from '@docker/extension-api-client';

const ddClient = createDockerDesktopClient();
```

Key APIs:

```typescript
// Invoke host binary (e.g., kubectl)
const result = await ddClient.extension.host?.cli.exec("kubectl", [
  "get", "pods", "-A"
]);
console.log(result?.stdout);

// Call backend service
const data = await ddClient.extension.vm?.service?.get("/api/endpoint");
await ddClient.extension.vm?.service?.post("/api/endpoint", { key: "value" });

// Execute command in backend container
await ddClient.extension.vm?.cli.exec("ls", ["-l"]);

// Docker CLI operations
await ddClient.docker.cli.exec("run", ["--rm", "alpine", "echo", "hello"]);
```

### Platform Detection

```typescript
if (ddClient.host.platform === 'win32') {
  // Windows-specific logic
} else if (ddClient.host.platform === 'darwin') {
  // macOS-specific logic
} else {
  // Linux
}
```

## Backend Service Layer

### Configuration
- **Framework**: Express.js 5.x
- **Entry point**: `./bin/www`
- **Socket**: `/run/guest-services/<extension-name>.sock` (via PORT env var)
- **Key dependencies**: `express`, `body-parser`, `yaml`

### Runtime Environment
The backend runs inside the Docker Desktop VM with access to:
- Docker socket
- Kubernetes API (via mounted kubeconfig or in-cluster config)
- CLI tools copied into the container

### Example Backend Structure
```
backend/
├── bin/
│   └── www              # Entry point
├── routes/
│   └── api.js           # API routes
├── package.json
└── app.js               # Express app setup
```

## Host Binaries

### Multi-Platform Support
Extensions should ship binaries for all platforms:
- `darwin/amd64` and `darwin/arm64`
- `linux/amd64` and `linux/arm64`
- `windows/amd64`

### Dockerfile Pattern (AppCo)

```dockerfile
# Fetcher stage - download platform-specific binaries
FROM alpine AS fetcher
ARG TARGETARCH

# Download kubectl for all platforms
RUN wget -O /kubectl-darwin "https://dl.k8s.io/.../kubectl-darwin-${TARGETARCH}"
RUN wget -O /kubectl-linux "https://dl.k8s.io/.../kubectl-linux-${TARGETARCH}"
RUN wget -O /kubectl-windows "https://dl.k8s.io/.../kubectl-windows-amd64.exe"

# Download helm similarly...

# Final stage
FROM alpine
COPY --from=fetcher /kubectl-darwin /darwin/kubectl
COPY --from=fetcher /kubectl-linux /linux/kubectl
COPY --from=fetcher /kubectl-windows /windows/kubectl.exe
```

### Invoking Host Binaries

```typescript
// Invoke kubectl from the frontend
const output = await ddClient.extension.host?.cli.exec("kubectl", [
  "get", "namespaces",
  "--context", "rancher-desktop",
  "-o", "json"
]);

const namespaces = JSON.parse(output?.stdout || "{}");
```

## Kubernetes Integration

The Extensions SDK does not provide direct Kubernetes API access. Instead:

1. **Ship kubectl** as a host binary
2. **Use the Docker Desktop Client** to invoke kubectl commands
3. **Persist kubeconfig** if needed (localStorage or backend)

### Checking Kubernetes Availability

```typescript
const checkKubernetes = async () => {
  try {
    const output = await ddClient.extension.host?.cli.exec("kubectl", [
      "cluster-info",
      "--request-timeout", "2s",
      "--context", "rancher-desktop"  // or "docker-desktop"
    ]);
    return !output?.stderr;
  } catch {
    return false;
  }
};
```

### Kubeconfig Handling

```typescript
// Get kubeconfig content
const kubeConfig = await ddClient.extension.host?.cli.exec("kubectl", [
  "config", "view", "--raw", "--minify"
]);

// Store in backend for later use
await ddClient.extension.vm?.service?.post("/store-kubeconfig", {
  data: kubeConfig?.stdout
});
```

## Docker Extension Metadata Labels

Extensions use OCI labels for marketplace metadata:

```dockerfile
LABEL org.opencontainers.image.title="My Extension"
LABEL org.opencontainers.image.description="Extension description"
LABEL org.opencontainers.image.vendor="My Company"
LABEL com.docker.desktop.extension.api.version="0.3.4"
LABEL com.docker.extension.categories="kubernetes,utility-tools"
LABEL com.docker.desktop.extension.icon="icon.svg"
LABEL com.docker.extension.screenshots="[{\"alt\":\"Screenshot\",\"url\":\"https://...\"}]"
```

## Multi-Stage Build Pattern (AppCo)

```dockerfile
# Stage 1: Fetch external binaries
FROM alpine AS fetcher
# ... download kubectl, helm, etc.

# Stage 2: Generate API clients (if using OpenAPI)
FROM node:22-alpine AS backend-client-generator
WORKDIR /app
RUN npm install @openapitools/openapi-generator-cli
RUN npx openapi-generator-cli generate ...

# Stage 3: Build UI
FROM node:22-alpine AS client-builder
WORKDIR /app
COPY ui/ .
COPY --from=backend-client-generator /app/autogenerated ./autogenerated
RUN npm ci && npm run build

# Stage 4: Prepare backend
FROM node:22-alpine AS backend-builder
WORKDIR /app
COPY backend/ .
RUN npm ci --omit=dev

# Stage 5: Final image
FROM alpine
# Copy UI build
COPY --from=client-builder /app/dist /ui
# Copy backend
COPY --from=backend-builder /app /backend
# Copy binaries for host deployment
COPY --from=fetcher /kubectl-darwin /darwin/kubectl
COPY --from=fetcher /kubectl-linux /linux/kubectl
COPY --from=fetcher /kubectl-windows /windows/kubectl.exe
# Copy metadata
COPY metadata.json /
COPY icon.svg /

WORKDIR /backend
ENV PORT=/run/guest-services/my-extension.sock
CMD ["./bin/www"]
```

## Development Workflow

### Build and Install
```bash
# Build the extension
docker build -t myorg/my-extension:latest .

# Install locally
docker extension install myorg/my-extension:latest

# Enable development mode for hot reload
docker extension dev ui-source myorg/my-extension:latest http://localhost:3000
```

### Debugging
```bash
# View extension containers (hidden by default)
# Settings > Extensions > Show system containers

# View logs
docker extension dev debug myorg/my-extension:latest
```

## Key Differences: Docker Desktop vs Rancher Desktop

| Feature | Docker Desktop | Rancher Desktop |
|---------|---------------|-----------------|
| Kubernetes context | `docker-desktop` | `rancher-desktop` |
| Container runtime | Docker Engine | containerd or dockerd |
| Extension support | Native | Compatible (same SDK) |

## Reference: AppCo Extension Structure

```
application-collection-extension/
├── Dockerfile
├── metadata.json
├── ui/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Helm/
│   │   │   │   ├── InstallDialog.tsx
│   │   │   │   ├── UpgradeDialog.tsx
│   │   │   │   └── UninstallDialog.tsx
│   │   │   └── ...
│   │   └── ...
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── bin/www
│   ├── app.js
│   ├── routes/
│   └── package.json
└── icons/
    └── icon.svg
```

## Sources

- Docker Extensions SDK: `docs/background/docker-extensions/`
- AppCo Extension Wiki: `docs/background/wiki/rancherlabs/application-collection-extension/`
