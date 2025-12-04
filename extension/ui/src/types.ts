// Shared type definitions

export type FleetStatus = 'checking' | 'not-installed' | 'installing' | 'initializing' | 'running' | 'error';

// Bundle information for dependency resolution
export interface BundleInfo {
  bundleName: string;       // Computed: gitRepoName-path.replace(/\//g, '-')
  gitRepoName: string;      // GitRepo metadata.name (NOT the Git URL)
  path: string;             // Path within repo
  dependsOn: string[];      // Bundle names this path depends on (from fleet.yaml)
}

// Dependency resolution result
export interface DependencyResolution {
  canSelect: boolean;           // Whether this path can be selected
  blockedBy: string[];          // External deps that block selection (not in any GitRepo)
  willAutoSelect: BundleInfo[]; // Bundles that will be auto-selected (same-repo + cross-repo)
  requiredBy: string[];         // Bundle names that depend on this one (for preventing deselection)
}

export interface FleetState {
  status: FleetStatus;
  version?: string;
  error?: string;
  message?: string;  // Status message for initializing state
}

export interface GitRepo {
  name: string;
  repo: string;
  branch?: string;
  paths?: string[];
  paused?: boolean;  // When true, Fleet clones repo but doesn't deploy bundles
  status?: {
    ready: boolean;
    display?: {
      state?: string;
      message?: string;
      error?: boolean;
    };
    desiredReadyClusters: number;
    readyClusters: number;
    resources?: Array<{
      kind: string;
      name: string;
      state: string;
    }>;
    conditions?: Array<{
      type: string;
      status: string;
      message?: string;
    }>;
  };
}
