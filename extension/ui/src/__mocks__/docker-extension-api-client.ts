import { vi } from 'vitest';

// Mock for @docker/extension-api-client
export const createDockerDesktopClient = () => ({
  extension: {
    host: {
      cli: {
        exec: vi.fn(),
      },
    },
  },
});
