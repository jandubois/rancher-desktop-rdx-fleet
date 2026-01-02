/**
 * Vitest setup file for Vue testing.
 */

import { vi } from 'vitest';
import { config } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

// Create Vuetify instance for tests
const vuetify = createVuetify({
  components,
  directives,
});

// Global plugins for all tests
config.global.plugins = [vuetify];

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock Docker Desktop client
vi.mock('./lib/ddClient', () => ({
  ddClient: {
    extension: {
      vm: {
        service: {
          get: vi.fn(),
          post: vi.fn(),
        },
      },
    },
  },
}));
