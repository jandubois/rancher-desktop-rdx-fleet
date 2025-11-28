import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock the ddClient globally
vi.mock('./src/lib/ddClient', () => ({
  ddClient: {
    extension: {
      host: {
        cli: {
          exec: vi.fn(),
        },
      },
    },
  },
}));
