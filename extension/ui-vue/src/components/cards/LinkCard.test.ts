/**
 * Unit tests for the LinkCard component.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import LinkCard from './LinkCard.vue';

// Mock CardWrapper
vi.mock('./CardWrapper.vue', () => ({
  default: {
    name: 'CardWrapper',
    template: '<div class="mock-card-wrapper"><slot /></div>',
    props: ['title', 'cardId', 'duplicatable'],
  },
}));

// Mock window.open
const mockOpen = vi.fn();
vi.stubGlobal('open', mockOpen);

describe('LinkCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('buttons variant', () => {
    it('should render links as buttons by default', () => {
      const wrapper = mount(LinkCard, {
        props: {
          id: 'test-link',
          title: 'Links',
          settings: {
            links: [
              { url: 'https://example.com', label: 'Example' },
            ],
          },
        },
      });

      expect(wrapper.find('.button-links').exists()).toBe(true);
      expect(wrapper.find('.v-btn').exists()).toBe(true);
    });

    it('should render multiple link buttons', () => {
      const wrapper = mount(LinkCard, {
        props: {
          id: 'test-link',
          settings: {
            variant: 'buttons',
            links: [
              { url: 'https://example1.com', label: 'Link 1' },
              { url: 'https://example2.com', label: 'Link 2' },
              { url: 'https://example3.com', label: 'Link 3' },
            ],
          },
        },
      });

      const buttons = wrapper.findAll('.v-btn');
      expect(buttons.length).toBe(3);
    });

    it('should display link labels', () => {
      const wrapper = mount(LinkCard, {
        props: {
          id: 'test-link',
          settings: {
            links: [
              { url: 'https://github.com', label: 'GitHub' },
            ],
          },
        },
      });

      expect(wrapper.text()).toContain('GitHub');
    });

    it('should open link in new tab when button is clicked', async () => {
      const wrapper = mount(LinkCard, {
        props: {
          id: 'test-link',
          settings: {
            links: [
              { url: 'https://example.com', label: 'Example' },
            ],
          },
        },
      });

      await wrapper.find('.v-btn').trigger('click');

      expect(mockOpen).toHaveBeenCalledWith(
        'https://example.com',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  describe('list variant', () => {
    it('should render links as list items', () => {
      const wrapper = mount(LinkCard, {
        props: {
          id: 'test-link',
          settings: {
            variant: 'list',
            links: [
              { url: 'https://example.com', label: 'Example' },
            ],
          },
        },
      });

      expect(wrapper.find('.v-list').exists()).toBe(true);
      expect(wrapper.find('.v-list-item').exists()).toBe(true);
    });

    it('should set href on list items', () => {
      const wrapper = mount(LinkCard, {
        props: {
          id: 'test-link',
          settings: {
            variant: 'list',
            links: [
              { url: 'https://docs.example.com', label: 'Docs' },
            ],
          },
        },
      });

      const listItem = wrapper.find('.v-list-item');
      expect(listItem.attributes('href')).toBe('https://docs.example.com');
    });
  });

  describe('icon mapping', () => {
    it('should map GitHub icon correctly', () => {
      const wrapper = mount(LinkCard, {
        props: {
          id: 'test-link',
          settings: {
            links: [
              { url: 'https://github.com', label: 'GitHub', icon: 'GitHub' },
            ],
          },
        },
      });

      const icon = wrapper.find('.v-icon');
      expect(icon.exists()).toBe(true);
    });

    it('should use default icon when not specified', () => {
      const wrapper = mount(LinkCard, {
        props: {
          id: 'test-link',
          settings: {
            links: [
              { url: 'https://example.com', label: 'Example' },
            ],
          },
        },
      });

      const icon = wrapper.find('.v-icon');
      expect(icon.exists()).toBe(true);
    });
  });

  describe('empty state', () => {
    it('should show empty message when no links', () => {
      const wrapper = mount(LinkCard, {
        props: {
          id: 'test-link',
          settings: {
            links: [],
          },
        },
      });

      expect(wrapper.find('.no-links').exists()).toBe(true);
      expect(wrapper.text()).toContain('No links configured');
    });

    it('should show empty message when settings is undefined', () => {
      const wrapper = mount(LinkCard, {
        props: { id: 'test-link' },
      });

      expect(wrapper.find('.no-links').exists()).toBe(true);
    });
  });
});
