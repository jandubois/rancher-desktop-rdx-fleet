// Shared type definitions

export type FleetStatus = 'checking' | 'not-installed' | 'initializing' | 'running' | 'error';

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
