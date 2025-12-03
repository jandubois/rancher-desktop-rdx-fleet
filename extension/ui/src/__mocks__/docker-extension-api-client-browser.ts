/**
 * Browser-compatible mock for @docker/extension-api-client.
 * This is used during E2E testing with Playwright when running the Vite dev server
 * outside of Docker Desktop.
 *
 * Unlike the vitest mock, this doesn't depend on vi.fn() and works in real browsers.
 */

// Track all exec calls for potential debugging
const execCalls: Array<{ command: string; args: string[] }> = [];

// Mock responses for different commands
const mockResponses: Map<string, { stdout: string; stderr: string }> = new Map();

/**
 * Set a mock response for a specific command.
 * This can be called from browser console for debugging:
 * window.__mockDdClient.setResponse('kubectl', ['get', 'pods'], { stdout: 'pod1\npod2', stderr: '' })
 */
function setResponse(command: string, args: string[], response: { stdout: string; stderr: string }) {
  const key = `${command}:${JSON.stringify(args)}`;
  mockResponses.set(key, response);
}

/**
 * Set a default response for a command (matches any args)
 */
function setDefaultResponse(command: string, response: { stdout: string; stderr: string }) {
  mockResponses.set(`${command}:*`, response);
}

/**
 * Get all exec calls made (useful for debugging)
 */
function getExecCalls() {
  return [...execCalls];
}

/**
 * Clear all mock responses and calls
 */
function reset() {
  execCalls.length = 0;
  mockResponses.clear();
  setupDefaultResponses();
}

/**
 * Set up default mock responses for common commands
 */
function setupDefaultResponses() {
  // Fleet controller deployment status - mock as running
  setDefaultResponse('kubectl', {
    stdout: JSON.stringify({
      kind: 'Deployment',
      metadata: { name: 'fleet-controller' },
      status: { readyReplicas: 1, replicas: 1 },
    }),
    stderr: '',
  });

  // Helm - mock as installed
  setDefaultResponse('helm', {
    stdout: 'fleet\n',
    stderr: '',
  });
}

// Initialize default responses
setupDefaultResponses();

// Mock control interface for debugging
const mockControl = {
  setResponse,
  setDefaultResponse,
  getExecCalls,
  reset,
};

// Expose mock control to window for debugging
if (typeof window !== 'undefined') {
  (window as Window & { __mockDdClient?: typeof mockControl }).__mockDdClient = mockControl;
}

/**
 * Mock Docker Desktop client that provides the same interface as the real client.
 */
export function createDockerDesktopClient() {
  return {
    extension: {
      host: {
        cli: {
          exec: async (command: string, args: string[]): Promise<{ stdout: string; stderr: string }> => {
            execCalls.push({ command, args });

            // Try exact match first
            const exactKey = `${command}:${JSON.stringify(args)}`;
            if (mockResponses.has(exactKey)) {
              return mockResponses.get(exactKey)!;
            }

            // Try default response for command
            const defaultKey = `${command}:*`;
            if (mockResponses.has(defaultKey)) {
              return mockResponses.get(defaultKey)!;
            }

            // Default response - empty
            console.log(`[MockDdClient] No mock for: ${command} ${args.join(' ')}`);
            return { stdout: '', stderr: '' };
          },
        },
      },
      vm: {
        cli: {
          exec: async (command: string, args: string[]): Promise<{ stdout: string; stderr: string }> => {
            // Same as host.cli.exec for simplicity
            execCalls.push({ command, args });
            return { stdout: '', stderr: '' };
          },
        },
      },
    },
    desktopUI: {
      toast: {
        success: (message: string) => console.log(`[Toast Success] ${message}`),
        warning: (message: string) => console.log(`[Toast Warning] ${message}`),
        error: (message: string) => console.log(`[Toast Error] ${message}`),
      },
      navigate: {
        viewContainers: () => console.log('[Navigate] viewContainers'),
        viewImages: () => console.log('[Navigate] viewImages'),
        viewVolumes: () => console.log('[Navigate] viewVolumes'),
      },
    },
    docker: {
      cli: {
        exec: async (command: string, args: string[]): Promise<{ stdout: string; stderr: string }> => {
          execCalls.push({ command: 'docker', args: [command, ...args] });
          return { stdout: '', stderr: '' };
        },
      },
    },
  };
}

export default { createDockerDesktopClient };
