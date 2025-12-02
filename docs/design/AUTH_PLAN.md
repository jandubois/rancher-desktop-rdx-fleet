# Authentication System Design

This document outlines the comprehensive authentication requirements for the Fleet Management Extension, covering all credential scenarios and implementation strategies.

## Table of Contents

1. [Overview](#overview)
2. [Authentication Scenarios](#authentication-scenarios)
3. [Credential Storage Strategy](#credential-storage-strategy)
4. [Implementation by Provider](#implementation-by-provider)
5. [Architecture & Integration](#architecture--integration)
6. [Security Considerations](#security-considerations)
7. [UI/UX Design](#uiux-design)
8. [Implementation Phases](#implementation-phases)

---

## Overview

### Why Authentication?

The extension needs authentication for several critical use cases:

| Use Case | Without Auth | With Auth |
|----------|--------------|-----------|
| GitHub API | 60 requests/hour | 5,000 requests/hour |
| Private GitHub repos | Not accessible | Full access |
| Private container images | Not pullable | Pullable via imagePullSecrets |
| AppCo charts | Not accessible | Full catalog access |
| Private Helm repos | Not accessible | Chart installation possible |

### Authentication Providers

1. **GitHub** - For repository access and API rate limits
2. **Container Registries** - Docker Hub, GHCR, Quay.io, private registries
3. **AppCo (SUSE Application Collection)** - OCI registry at `dp.apps.rancher.io`
4. **Helm Repositories** - HTTP basic auth for private repos

---

## Authentication Scenarios

### Scenario 1: GitHub Authentication

**Purpose:**
- Access private repositories
- Increase API rate limit from 60 to 5,000 requests/hour
- List and browse private org repositories

**Auth Methods (in order of preference):**

| Method | User Experience | Security | Complexity |
|--------|-----------------|----------|------------|
| Local `gh` CLI token | Best (zero config) | Uses existing auth | Low |
| Personal Access Token (PAT) | Good (one-time entry) | Token exposure risk | Low |
| OAuth Device Flow | Good (browser auth) | Most secure | Medium |
| GitHub App | Enterprise | Most controlled | High |

**Token Sources:**

```
Priority 1: Local gh CLI (~/.config/gh/hosts.yml)
          └── Extract oauth_token for github.com

Priority 2: Environment variable (GITHUB_TOKEN)
          └── Common in CI/CD, may exist on developer machines

Priority 3: User-provided PAT
          └── UI input, stored in Kubernetes Secret

Priority 4: OAuth Device Flow
          └── Browser-based authentication
```

**Required Scopes:**
- `repo` - Full control of private repositories (for private repo access)
- `read:org` - Read org membership (for org repo listing)
- Or minimal: `public_repo` for just rate limit increase

### Scenario 2: Container Registry Authentication

**Purpose:**
- Pull private container images referenced in Fleet bundles
- Push images (future feature)

**Registries to Support:**

| Registry | Domain | Auth Method |
|----------|--------|-------------|
| Docker Hub | `docker.io` | Username + Access Token |
| GitHub Container Registry | `ghcr.io` | Username + PAT (read:packages) |
| Google Container Registry | `gcr.io` | JSON key or gcloud auth |
| Amazon ECR | `*.dkr.ecr.*.amazonaws.com` | AWS credentials |
| Azure ACR | `*.azurecr.io` | Service principal |
| Quay.io | `quay.io` | Robot account or OAuth |
| Harbor | Custom | Username + Password |
| AppCo | `dp.apps.rancher.io` | Username + Access Token |

**How Fleet Uses Registry Credentials:**

Fleet pulls images during bundle deployment. Credentials must be available as Kubernetes `imagePullSecrets`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: regcred
  namespace: fleet-local  # Or target namespace
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64-encoded-docker-config>
```

The docker config format:
```json
{
  "auths": {
    "https://index.docker.io/v1/": {
      "auth": "<base64(username:password)>"
    },
    "ghcr.io": {
      "auth": "<base64(username:token)>"
    }
  }
}
```

### Scenario 3: AppCo Authentication

**Purpose:**
- Access SUSE Application Collection catalog
- Pull Helm charts from `oci://dp.apps.rancher.io/charts/*`
- Pull container images from `dp.apps.rancher.io`

**Auth Methods:**

| Account Type | Username | Password | Use Case |
|--------------|----------|----------|----------|
| User Account | Email or username | Access Token | Interactive use |
| Service Account | Service account name | Secret | Automation/CI |

**Endpoints Requiring Auth:**
- `https://api.apps.rancher.io/` - Catalog API (REST)
- `dp.apps.rancher.io` - OCI registry (charts + images)

**Credential Usage:**
```bash
# API access
curl -u "$USERNAME:$TOKEN" https://api.apps.rancher.io/v1/apps

# Helm login
helm registry login dp.apps.rancher.io -u "$USERNAME" -p "$TOKEN"

# Docker login (for container images)
docker login dp.apps.rancher.io -u "$USERNAME" -p "$TOKEN"
```

### Scenario 4: Private Helm Repositories

**Purpose:**
- Access private Helm chart repositories (non-OCI HTTP repos)
- ChartMuseum, Harbor, Artifactory, etc.

**Auth Methods:**
- HTTP Basic Auth (username + password)
- Bearer token
- Certificate-based (mTLS)

**How Fleet Handles Helm Auth:**

For traditional HTTP Helm repos:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: helm-repo-auth
  namespace: fleet-local
type: Opaque
data:
  username: <base64>
  password: <base64>
```

Referenced via `helmSecretName` in GitRepo or Bundle.

For OCI registries (including AppCo), use `imagePullSecrets` approach.

---

## Credential Storage Strategy

### Critical Constraint: Rancher Desktop Kubernetes Resets

Rancher Desktop allows users to upgrade/downgrade Kubernetes versions. During these operations (especially downgrades), **all cluster data is lost**, including Kubernetes Secrets. This makes in-cluster storage unreliable for credential persistence.

Additionally, users expect `docker pull` from the command line to work with stored credentials, which requires Docker-native credential storage.

### Decision: Host Docker Credentials (Primary)

**Storage Comparison:**

| Storage Option | Survives K8s Reset | Docker CLI Works | Security | Decision |
|----------------|-------------------|------------------|----------|----------|
| Host Docker config + credential helpers | ✅ Yes | ✅ Yes | High (encrypted) | **Primary** |
| Kubernetes Secrets | ❌ No | ❌ No | Medium | Derived only |
| Browser localStorage | ✅ Yes | ❌ No | Low | Temporary only |
| Host file system (plain) | ✅ Yes | ❌ No | Low | Not recommended |

### Storage Architecture (Revised)

```
┌─────────────────────────────────────────────────────────────┐
│                         HOST MACHINE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ~/.docker/config.json (Docker credential configuration)     │
│  ├── credsStore: "osxkeychain" | "wincred" | "secretservice"│
│  └── auths: { registry -> credential helper reference }      │
│                                                              │
│  Platform Credential Helper (encrypted, persistent)          │
│  ├── macOS: Keychain (docker-credential-osxkeychain)        │
│  ├── Windows: Credential Manager (docker-credential-wincred)│
│  └── Linux: Secret Service/pass (docker-credential-*)       │
│                                                              │
│  ~/.config/gh/hosts.yml (GitHub CLI tokens)                 │
│  └── github.com -> oauth_token                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                   Host scripts via rd-exec
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Extension UI (Browser)                    │
├─────────────────────────────────────────────────────────────┤
│  localStorage (temporary session state only)                 │
│  └── oauth_state (for OAuth flow CSRF protection)           │
└─────────────────────────────────────────────────────────────┘
                              │
              Derived on-demand (recreatable)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Kubernetes Cluster (ephemeral)                  │
├─────────────────────────────────────────────────────────────┤
│  Namespace: fleet-local                                      │
│  ├── Secret: fleet-ext-registry (dockerconfigjson)          │
│  │   └── Derived from host Docker credentials               │
│  └── Secret: fleet-ext-helm-* (for helmSecretName)          │
│      └── Derived from host credentials                      │
│                                                              │
│  ⚠️  These secrets are DERIVED, not primary storage!         │
│  ⚠️  Lost on K8s reset, recreated from host credentials      │
└─────────────────────────────────────────────────────────────┘
```

### Credential Flow

```
1. User enters credentials in UI
                │
                ▼
2. Extension validates credentials (API call)
                │
                ▼
3. Store in HOST via host script
   └── docker login (uses credential helper)
   └── Or: write to gh config for GitHub
                │
                ▼
4. Create derived Kubernetes Secret (for Fleet)
   └── Can be recreated if cluster resets
                │
                ▼
5. On cluster reset: Extension detects missing secrets
   └── Reads from host credentials
   └── Recreates Kubernetes Secrets automatically
```

### Platform Credential Helpers

Docker credential helpers provide secure, encrypted storage on each platform:

| Platform | Helper | Storage Backend | Installation |
|----------|--------|-----------------|--------------|
| macOS | `docker-credential-osxkeychain` | macOS Keychain | Included with Docker/RD |
| Windows | `docker-credential-wincred` | Windows Credential Manager | Included with Docker/RD |
| Linux (GNOME) | `docker-credential-secretservice` | GNOME Keyring | `apt install golang-docker-credential-helpers` |
| Linux (KDE) | `docker-credential-secretservice` | KWallet | `apt install golang-docker-credential-helpers` |
| Linux (headless) | `docker-credential-pass` | GPG-encrypted files | `apt install pass` |

**How credential helpers work:**

```bash
# Store credential (called by docker login)
echo '{"ServerURL":"ghcr.io","Username":"user","Secret":"token"}' \
  | docker-credential-osxkeychain store

# Retrieve credential
echo "ghcr.io" | docker-credential-osxkeychain get
# Returns: {"ServerURL":"ghcr.io","Username":"user","Secret":"token"}

# List all stored credentials
docker-credential-osxkeychain list
# Returns: {"ghcr.io":"user","docker.io":"user2"}
```

**~/.docker/config.json with credential helper:**
```json
{
  "credsStore": "osxkeychain",
  "auths": {
    "ghcr.io": {},
    "docker.io": {}
  }
}
```

Note: When a credential helper is configured, `auths` entries are empty - the actual credentials are in the system keychain.

### Host Script Requirements

New host scripts needed for credential management:

```
extension/host/
├── darwin/
│   ├── docker-login           # Wrapper for docker login
│   ├── docker-logout          # Wrapper for docker logout
│   ├── docker-cred-list       # List stored credentials
│   ├── docker-cred-get        # Get specific credential
│   └── gh-token               # Extract gh CLI token
├── linux/
│   ├── docker-login
│   ├── docker-logout
│   ├── docker-cred-list
│   ├── docker-cred-get
│   └── gh-token
└── windows/
    ├── docker-login.cmd
    ├── docker-logout.cmd
    ├── docker-cred-list.cmd
    ├── docker-cred-get.cmd
    └── gh-token.cmd
```

### Kubernetes Secret Naming Convention

For derived secrets that Fleet needs:

```
fleet-ext-<type>[-<identifier>]

Examples:
- fleet-ext-registry              # Combined registry credentials (dockerconfigjson)
- fleet-ext-helm-chartmuseum      # Helm repo credentials (for helmSecretName)
```

### Token Separation: API vs Registry

**Important:** GitHub API tokens and container registry tokens serve different purposes and should be treated separately:

| Token Type | Purpose | Scopes | Used By |
|------------|---------|--------|---------|
| **GitHub API** | Rate limits, private repo scanning | `repo`, `read:org` | Extension UI (path discovery) |
| **GHCR (ghcr.io)** | Pull/push container images | `read:packages` | Docker CLI, Fleet deployments |
| **Docker Hub** | Pull/push container images | N/A (access token) | Docker CLI, Fleet deployments |
| **AppCo** | Helm charts + container images | N/A (access token) | Docker CLI, Helm, Fleet |

**Why separate?**
- GitHub API token may have broad scopes (`repo`) for accessing private repos
- Registry tokens should have minimal scopes (just `read:packages`)
- Users may want different tokens with different expiration policies
- Clearer audit trail when tokens are purpose-specific

### GitHub API Token Storage

GitHub API tokens are used for rate limits and private repo scanning (NOT for image pulls):

| Source | Location | Extraction | Use Case |
|--------|----------|------------|----------|
| `gh` CLI | `~/.config/gh/hosts.yml` | `gh auth token` | Convenience option |
| User PAT | Entered in UI | Direct | Always available |
| OAuth | Device flow | Browser auth | Future |

**UI Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub API Authentication                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Options (always show both when gh CLI is available):       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [Use gh CLI token]  ← Only shown if gh is installed │    │
│  │   Uses your existing gh authentication              │    │
│  │   Token has scopes: repo, read:org, ...             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ─────────────────── OR ───────────────────                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Enter Personal Access Token                          │    │
│  │ [________________________________]                   │    │
│  │                                                      │    │
│  │ [Create token on GitHub ↗]  [Save]                  │    │
│  │                                                      │    │
│  │ Recommended scopes: public_repo (or repo for        │    │
│  │ private repos), read:org                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Why offer both options?**
- User may not have `gh` CLI installed
- User may have `gh` but not authenticated
- User may prefer a token with limited scopes (e.g., just `public_repo` for rate limits)
- User may want a dedicated token for this extension (separate audit trail)

**Storage for user-provided PAT:**
- Use `docker-credential-*` with server URL `github.com`
- Credential helpers support any server URL, not just registries
- Encrypted, persistent, survives K8s resets

**Detection logic:**
```
1. Check if gh CLI is installed: `which gh`
2. If installed, check if authenticated: `gh auth status`
3. Show appropriate UI:
   - gh available + authenticated: Show both options
   - gh available + not authenticated: Show PAT input only (with note about gh)
   - gh not available: Show PAT input only
```

### Credential Helper Requirement (Linux)

On Linux, a credential helper must be configured before storing credentials:

```
┌─────────────────────────────────────────────────────────────┐
│  Linux Credential Helper Check                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Check ~/.docker/config.json for "credsStore"            │
│     ├── If set: Use configured helper                       │
│     └── If not set: Check for available helpers             │
│                                                              │
│  2. Check for available credential helpers:                  │
│     ├── docker-credential-secretservice (GNOME/KDE)         │
│     └── docker-credential-pass (GPG-based)                  │
│                                                              │
│  3. If no helper available:                                  │
│     └── Show error with setup instructions                  │
│         "Credential helper required. Install one of:"       │
│         - sudo apt install golang-docker-credential-helpers │
│         - Or configure 'pass': apt install pass             │
│                                                              │
│  ⚠️  We do NOT fall back to plaintext storage                │
└─────────────────────────────────────────────────────────────┘
```

**macOS/Windows:** Credential helpers are bundled with Rancher Desktop and work out of the box.

### Retrieving `gh` CLI Token

The local `gh` CLI stores tokens in a YAML file:

**Location:** `~/.config/gh/hosts.yml` (Linux/macOS) or `%APPDATA%\gh\hosts.yml` (Windows)

**Format:**
```yaml
github.com:
    user: username
    oauth_token: gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    git_protocol: https
```

**Extraction approach:**
```bash
# Via host script
cat ~/.config/gh/hosts.yml | grep oauth_token | awk '{print $2}'

# Or using gh CLI directly
gh auth token
```

**Security Note:** The `gh auth token` command is safer as it respects the gh CLI's security model.

---

## Implementation by Provider

### GitHub Implementation

#### GitHub API Token Flow

The UI always shows the PAT input option. When `gh` CLI is available and authenticated, we also offer a convenience button to use the existing token.

```
┌─────────────────────────────────────────────────────────────┐
│  On card load:                                               │
│  1. Check for stored PAT in credential helper               │
│  2. Check gh CLI availability and auth status               │
│  3. Render appropriate UI state                             │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  State A: Already authenticated (PAT stored)                │
│  ├── Show: "Authenticated as @username"                     │
│  ├── Show: Rate limit status                                │
│  └── Show: [Disconnect] button                              │
├─────────────────────────────────────────────────────────────┤
│  State B: Not authenticated, gh available                   │
│  ├── Show: [Use gh CLI token] button                        │
│  ├── Show: PAT input field                                  │
│  └── Show: [Create token ↗] link                           │
├─────────────────────────────────────────────────────────────┤
│  State C: Not authenticated, gh not available               │
│  ├── Show: PAT input field                                  │
│  └── Show: [Create token ↗] link                           │
└─────────────────────────────────────────────────────────────┘
```

#### Using `gh` CLI Token

```
User clicks "Use gh CLI token"
        │
        ▼
Extension calls host script: gh auth token
        │
        ▼
Token returned → Validate via GitHub API (GET /user)
        │
        ▼
Store in credential helper (server: "github.com")
  └── This way we have a consistent storage location
        │
        ▼
Show authenticated user + rate limit
```

**Note:** We store the `gh` token in our credential helper so we don't need to re-extract it every time. User can "Disconnect" to clear it.

#### Using Personal Access Token (PAT)

```
User enters PAT in input field → clicks Save
        │
        ▼
Validate token via GET /user (also fetches username)
        │
        ▼
Store in host credential helper (docker-credential-*)
  └── Server: "github.com"
        │
        ▼
Show authenticated username + rate limit
```

**Token Creation URL:**
```
https://github.com/settings/tokens/new?scopes=repo,read:org&description=Fleet+Extension
```

**Recommended scopes:**
- `public_repo` - Minimum for rate limit increase (60 → 5000/hr)
- `repo` - For private repository access
- `read:org` - For organization repository listing

#### OAuth Device Flow (Future)

```
User clicks "Sign in with GitHub"
        │
        ▼
POST https://github.com/login/device/code
     client_id=<our_app_id>
     scope=repo,read:org
        │
        ▼
Display user_code, open verification_uri in browser
        │
        ▼
Poll POST https://github.com/login/oauth/access_token
     device_code=<device_code>
     grant_type=urn:ietf:params:oauth:grant-type:device_code
        │
        ▼
Receive access_token → Store in host credential helper
```

**Note:** Requires a registered GitHub OAuth App. Consider whether to:
- Create an official Rancher/SUSE GitHub App
- Allow users to provide their own OAuth App credentials
- Use device flow which doesn't require redirect URIs

### Container Registry Implementation

#### Generic Flow:

```
User selects registry type (Docker Hub, GHCR, etc.)
        │
        ▼
Enter credentials (username + token/password)
        │
        ▼
Validate credentials (registry-specific)
        │
        ▼
Store via host script: docker login <registry>
  └── Uses platform credential helper (Keychain/wincred/secretservice)
        │
        ▼
docker pull now works from command line ✓
        │
        ▼
Create derived Kubernetes Secret (for Fleet imagePullSecrets)
  └── Read from host, create in cluster
  └── Recreate automatically on cluster reset
```

#### Registry-Specific Validation:

| Registry | Validation Endpoint |
|----------|---------------------|
| Docker Hub | `GET https://hub.docker.com/v2/users/login` |
| GHCR | `GET https://ghcr.io/v2/` with Bearer token |
| Quay.io | `GET https://quay.io/v2/` with Bearer token |
| Generic | `GET https://<registry>/v2/` with Basic auth |

### AppCo Implementation

```
User enters AppCo credentials
        │
        ▼
Validate via AppCo API
GET https://api.apps.rancher.io/v1/user
Authorization: Basic <base64(user:token)>
        │
        ▼
Create combined Secret:
├── username/password (for API calls)
└── .dockerconfigjson (for OCI registry)
        │
        ▼
Enable AppCo catalog browsing
```

---

## Architecture & Integration

### Service Layer Changes

```
┌─────────────────────────────────────────────────────────────┐
│                  New: CredentialService                      │
├─────────────────────────────────────────────────────────────┤
│  Responsibilities:                                           │
│  - Host credential storage (via docker login)               │
│  - Host credential retrieval (via credential helpers)       │
│  - GitHub token extraction (via gh CLI)                     │
│  - Credential validation                                     │
│  - Kubernetes secret derivation (from host creds)           │
│                                                              │
│  Host Credential Methods:                                    │
│  - getGitHubToken(): Promise<string | null>                 │
│  - storeRegistryCredential(registry, user, token): Promise  │
│  - getRegistryCredential(registry): Promise<Credential>     │
│  - listRegistryCredentials(): Promise<CredentialInfo[]>     │
│  - removeRegistryCredential(registry): Promise<void>        │
│                                                              │
│  Validation Methods:                                         │
│  - validateGitHubToken(token): Promise<GitHubUser>          │
│  - validateRegistryCredential(registry, cred): Promise<bool>│
│  - validateAppCoCredential(cred): Promise<AppCoUser>        │
│                                                              │
│  Kubernetes Secret Methods (derived):                        │
│  - syncRegistrySecretsToCluster(): Promise<void>            │
│  - getClusterRegistrySecret(): Promise<Secret | null>       │
│  - deleteClusterRegistrySecret(): Promise<void>             │
└─────────────────────────────────────────────────────────────┘
```

### Host Script Interface

```typescript
// New interface for host credential operations
interface HostCredentialExecutor {
  // GitHub
  getGhToken(): Promise<string | null>;

  // Docker credentials
  dockerLogin(registry: string, username: string, password: string): Promise<void>;
  dockerLogout(registry: string): Promise<void>;
  dockerCredList(): Promise<Record<string, string>>;  // {registry: username}
  dockerCredGet(registry: string): Promise<{username: string, secret: string}>;

  // Helm (for OCI registries)
  helmRegistryLogin(registry: string, username: string, password: string): Promise<void>;
  helmRegistryLogout(registry: string): Promise<void>;
}
```

### KubernetesService Enhancements

```typescript
// New methods needed:
interface KubernetesService {
  // Existing
  applyGitRepo(gitRepo: GitRepoResource): Promise<void>;

  // New: Secret management (for derived secrets)
  createSecret(secret: SecretResource): Promise<void>;
  getSecret(name: string, namespace: string): Promise<SecretResource | null>;
  deleteSecret(name: string, namespace: string): Promise<void>;
  listSecrets(namespace: string, labelSelector?: string): Promise<SecretResource[]>;

  // Convenience: Create dockerconfigjson secret from host credentials
  syncRegistrySecretFromHost(
    secretName: string,
    registries: string[]
  ): Promise<void>;
}
```

### GitHubService Enhancements

```typescript
interface GitHubService {
  // Existing (update to use auth)
  fetchAvailablePaths(url: string): Promise<PathInfo[]>;

  // New
  setAuthToken(token: string): void;
  clearAuthToken(): void;
  validateToken(token: string): Promise<GitHubUser>;
  getCurrentUser(): Promise<GitHubUser | null>;
  getRateLimit(): Promise<RateLimitInfo>;
}
```

### HttpClient Enhancements

```typescript
interface HttpClient {
  // Existing
  get(url: string): Promise<HttpResponse>;

  // New
  post(url: string, body: any, headers?: Headers): Promise<HttpResponse>;
  setDefaultHeader(key: string, value: string): void;
  removeDefaultHeader(key: string): void;
}
```

### New Card Types

```typescript
// Auth card configurations
interface AuthGitHubCardContent {
  type: 'auth-github';
  settings: {
    required: boolean;        // Block other operations until authenticated
    show_status: boolean;     // Show current auth status
    allow_gh_cli: boolean;    // Allow fetching from gh CLI
    allow_pat: boolean;       // Allow PAT entry
    allow_oauth: boolean;     // Allow OAuth flow
    suggested_scopes: string[]; // ['repo', 'read:org']
  };
}

interface AuthRegistryCardContent {
  type: 'auth-registry';
  settings: {
    registry: string;         // 'dockerhub' | 'ghcr' | 'appco' | 'custom'
    custom_url?: string;      // For custom registries
    required: boolean;
    show_status: boolean;
  };
}

interface AuthAppCoCardContent {
  type: 'auth-appco';
  settings: {
    required: boolean;
    show_status: boolean;
    show_catalog_link: boolean;
  };
}
```

---

## Security Considerations

### Token Handling

1. **Never log tokens** - Mask in all log output
2. **Minimal scope** - Request only needed permissions
3. **Secure transmission** - HTTPS only, no URL parameters
4. **Memory cleanup** - Clear tokens from memory when not needed

### Secret Security

1. **Namespace isolation** - Store in `fleet-local` namespace
2. **RBAC** - Extension needs Secret read/write in fleet-local only
3. **Labeling** - Label secrets for identification:
   ```yaml
   metadata:
     labels:
       app.kubernetes.io/managed-by: fleet-extension
       fleet-extension/credential-type: github
   ```

### Browser Security

1. **localStorage limitations**:
   - Use only for temporary session state
   - Never store long-lived tokens
   - Clear on logout/disconnect

2. **OAuth state validation**:
   - Use cryptographically random state parameter
   - Validate state on callback
   - Short expiration on pending auth flows

### Credential Rotation

1. **Token expiration detection** - Handle 401 responses gracefully
2. **Refresh flow** - For OAuth tokens with refresh_token
3. **User notification** - Alert when credentials expire

---

## UI/UX Design

### Auth Card States

```
┌─────────────────────────────────────────┐
│ GitHub Authentication          [?]      │
├─────────────────────────────────────────┤
│ Status: Not authenticated               │
│                                         │
│ [Use gh CLI] [Enter PAT] [Sign in]     │
│                                         │
│ Rate limit: 60/hour (unauthenticated)  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ GitHub Authentication          [?]      │
├─────────────────────────────────────────┤
│ ✓ Authenticated as @username            │
│   Scopes: repo, read:org                │
│                                         │
│ Rate limit: 4,892/5,000 remaining      │
│                                         │
│ [Disconnect]                            │
└─────────────────────────────────────────┘
```

### Registry Auth Card

```
┌─────────────────────────────────────────┐
│ Container Registry: Docker Hub  [?]     │
├─────────────────────────────────────────┤
│ Status: Not configured                  │
│                                         │
│ Username: [________________]            │
│ Access Token: [________________]        │
│                                         │
│ [Create Token ↗] [Save Credentials]     │
└─────────────────────────────────────────┘
```

### AppCo Auth Card

```
┌─────────────────────────────────────────┐
│ SUSE Application Collection     [?]     │
├─────────────────────────────────────────┤
│ ✓ Authenticated                         │
│   Account: user@example.com             │
│                                         │
│ [Browse Catalog ↗] [Disconnect]         │
└─────────────────────────────────────────┘
```

### Error States

```
┌─────────────────────────────────────────┐
│ GitHub Authentication          [!]      │
├─────────────────────────────────────────┤
│ ⚠ Authentication failed                 │
│   Token invalid or expired              │
│                                         │
│ [Retry] [Enter new token]               │
└─────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: GitHub API Authentication

**Goal:** Solve GitHub API rate limiting with full auth options

1. **Host scripts for credential management**
   - `gh-token` - Extract GitHub token from `gh` CLI
   - `gh-auth-status` - Check if `gh` CLI is authenticated
   - `cred-store` - Store credential in helper (server, username, secret)
   - `cred-get` - Retrieve credential from helper
   - `cred-delete` - Remove credential from helper
   - `cred-helper-check` - Verify credential helper is available (Linux)

2. **CredentialService (new service)**
   - Interface for host credential operations
   - Platform-agnostic credential storage/retrieval
   - GitHub token validation via API

3. **GitHub auth UI (`auth-github` card)**
   - Check for existing stored token on load
   - Detect `gh` CLI availability and auth status
   - Show "Use gh CLI token" button when available
   - Always show PAT input field as alternative
   - "Create token" link to GitHub settings
   - Display authenticated user + rate limit when connected
   - "Disconnect" button to clear stored token

4. **GitHubService integration**
   - Use stored token for API calls
   - Show rate limit in UI
   - Handle token expiration gracefully

### Phase 2: Registry Authentication + Docker CLI Integration

**Goal:** Enable `docker pull` for private images

1. **Registry credential cards**
   - Docker Hub auth card
   - GHCR auth card
   - Generic registry input

2. **Docker credential helper integration**
   - Store via `docker login` (uses platform helpers)
   - Retrieve via `docker-cred-get` for status display
   - Handle missing credential helper gracefully

3. **Credential validation**
   - Test pull before saving (or API validation)
   - Registry-specific validation endpoints
   - Clear error messages

4. **Derived Kubernetes Secrets**
   - Create `fleet-ext-registry` secret from host creds
   - Auto-recreate on cluster reset detection
   - Multi-registry support in single dockerconfigjson

### Phase 3: AppCo Integration

**Goal:** Full AppCo catalog access (both API and OCI registry)

1. **AppCo auth card**
   - Username/access token input
   - Account validation via AppCo API

2. **Dual credential storage**
   - OCI registry: `docker login dp.apps.rancher.io`
   - API token: Store for catalog browsing
   - Both via host credential helpers

3. **Helm registry login**
   - `helm registry login dp.apps.rancher.io`
   - For pulling OCI-based Helm charts

4. **Catalog integration**
   - Browse AppCo catalog
   - Install charts via Fleet

### Phase 4: Credential Management & Recovery

**Goal:** Polish credential management and handle edge cases

1. **Credential management UI**
   - List all stored credentials (from host)
   - Show credential health/status
   - Delete/disconnect individual credentials
   - "Test" button to validate credentials

2. **Cluster reset recovery**
   - Detect missing Kubernetes secrets on startup
   - Auto-recreate from host credentials
   - User notification of recovery

3. **Error handling improvements**
   - Token expiration detection and notification
   - Clear guidance for credential helper setup (Linux)
   - Retry logic for transient failures

### Phase 5: OAuth & Enterprise (Future)

**Goal:** Enterprise features and OAuth flow

1. **OAuth Device Flow**
   - GitHub OAuth App registration
   - Device flow implementation
   - Token storage in credential helper

2. **Enterprise features**
   - GitHub Enterprise Server support
   - Custom registry certificates
   - Proxy configuration

3. **Advanced Helm auth**
   - Private HTTP Helm repos
   - Certificate-based auth (mTLS)

---

## Open Questions

### Resolved

1. **Primary credential storage**: ~~Kubernetes Secrets vs host storage~~
   - **Decision:** Host Docker credentials (via credential helpers)
   - **Rationale:** Survives K8s resets, enables `docker pull` CLI

2. **Missing credential helper on Linux**: ~~Fall back to plaintext?~~
   - **Decision:** Refuse to authenticate; do not store credentials in plaintext
   - **Rationale:** Security-first approach. Users must configure a credential helper.
   - **UX:** Show clear error message with instructions to install `pass` or `secretservice`

3. **GHCR authentication**: ~~Auto-populate from `gh` token?~~
   - **Decision:** Require separate credentials for GHCR
   - **Rationale:** The `gh` CLI token is for GitHub API access (rate limits, private repo scanning). Container registry auth (GHCR, Docker Hub, AppCo) is separate and for deployment purposes.
   - **Implication:** Users need to create a PAT with `read:packages` scope specifically for GHCR

4. **Rancher Desktop credential helpers**:
   - **Finding:** RD bundles credential helpers on macOS/Windows, but does NOT auto-configure `pass`/`secretservice` on Linux
   - **Implication:** Linux users may need guidance to set up a credential helper

### Open

1. **OAuth App ownership**: Should we create an official GitHub OAuth App under Rancher/SUSE, or let users provide their own?

2. **Token scope granularity**: Should we support fine-grained PATs with minimal scopes, or request broad scopes for simplicity?

3. **Helm registry vs Docker login**: For OCI registries like AppCo, do we need both?
   - `docker login dp.apps.rancher.io` - for container images
   - `helm registry login dp.apps.rancher.io` - for Helm charts
   - Or does one suffice? (Helm may use Docker's credential store)
   - **Status:** Will investigate during implementation

4. **Multi-cluster credentials**: How should credentials work when managing multiple clusters?
   - Host credentials are shared (single machine)
   - Kubernetes secrets are per-cluster (derived)
   - Is this the right model?

---

## Troubleshooting & Debugging

### Important Notes

- **No browser console access**: When debugging extension issues, browser developer console is not available. All debug output must be displayed in the extension UI itself.
- **Host scripts run on host, not in container**: The extension UI runs in a container, but host scripts (gh-token, cred-helper-check, etc.) execute on the user's actual machine (macOS/Windows/Linux).
- **PATH limitations**: When Rancher Desktop starts via launchd (macOS) or similar mechanisms, the PATH may not include user-installed tools like Homebrew binaries (`/opt/homebrew/bin`) or `~/.rd/bin`.

### Debug Output

The credential helper check script includes debug output in its JSON response. When credential helper detection fails, the AuthGitHubCard will display debug information showing:

- HOME directory
- Docker config file location
- PATH environment variable
- Which directories were searched
- Which helpers were checked

This helps diagnose issues like:
- Missing credential helpers
- Incorrect PATH configuration
- Config file not found

### Common Issues

1. **"No credential helper configured" on macOS**
   - Ensure `docker-credential-osxkeychain` exists in `~/.rd/bin`, `/usr/local/bin`, or `/opt/homebrew/bin`
   - Check `~/.docker/config.json` has `"credsStore": "osxkeychain"`

2. **gh CLI not detected**
   - The `gh` binary must be in PATH or common locations (`~/.rd/bin`, `/opt/homebrew/bin`, `/usr/local/bin`)
   - Run `gh auth status` in terminal to verify authentication

3. **Scripts not executable**
   - Host scripts must have executable bit set: `chmod +x extension/host/darwin/*`

---

## References

- [Fleet Authentication Docs](https://fleet.rancher.io/ref-gitrepo#authentication)
- [GitHub OAuth Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- [Docker Registry Auth](https://docs.docker.com/engine/reference/commandline/login/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [AppCo Documentation](https://apps.rancher.io/docs)
- [Docker Extensions OAuth Guide](../../docs/background/docker-extensions/extensions-sdk/guides/oauth2-flow.md)
