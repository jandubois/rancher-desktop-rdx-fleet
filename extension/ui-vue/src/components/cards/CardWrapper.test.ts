/**
 * Unit tests for the CardWrapper component.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import CardWrapper from './CardWrapper.vue';

// Mock the manifest store
vi.mock('../../stores/manifest', () => ({
  useManifestStore: () => ({
    palette: {
      card: {
        border: '#e0e0e0',
        title: '#333333',
      },
    },
  }),
}));

describe('CardWrapper', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should render without title', () => {
    const wrapper = mount(CardWrapper, {
      slots: {
        default: '<p>Card content</p>',
      },
    });

    expect(wrapper.find('.v-card').exists()).toBe(true);
    expect(wrapper.find('.v-card-title').exists()).toBe(false);
    expect(wrapper.text()).toContain('Card content');
  });

  it('should render with title', () => {
    const wrapper = mount(CardWrapper, {
      props: {
        title: 'Test Title',
      },
      slots: {
        default: '<p>Card content</p>',
      },
    });

    expect(wrapper.find('.v-card-title').exists()).toBe(true);
    expect(wrapper.find('.v-card-title').text()).toBe('Test Title');
  });

  it('should apply border color from palette', () => {
    const wrapper = mount(CardWrapper, {
      props: {
        title: 'Test',
      },
    });

    expect(wrapper.find('.v-card').attributes('style')).toContain('border-color');
  });

  it('should apply title color from palette', () => {
    const wrapper = mount(CardWrapper, {
      props: {
        title: 'Test Title',
      },
    });

    expect(wrapper.find('.v-card-title').attributes('style')).toContain('color');
  });

  it('should render slot content', () => {
    const wrapper = mount(CardWrapper, {
      slots: {
        default: '<div class="test-content">Test slot content</div>',
      },
    });

    expect(wrapper.find('.test-content').exists()).toBe(true);
    expect(wrapper.text()).toContain('Test slot content');
  });

  it('should render actions slot when provided', () => {
    const wrapper = mount(CardWrapper, {
      slots: {
        default: '<p>Content</p>',
        actions: '<button>Action</button>',
      },
    });

    expect(wrapper.find('.v-card-actions').exists()).toBe(true);
    expect(wrapper.text()).toContain('Action');
  });

  it('should not render actions slot when not provided', () => {
    const wrapper = mount(CardWrapper, {
      slots: {
        default: '<p>Content</p>',
      },
    });

    expect(wrapper.find('.v-card-actions').exists()).toBe(false);
  });

  it('should apply no padding class when noPadding is true', () => {
    const wrapper = mount(CardWrapper, {
      props: {
        noPadding: true,
      },
      slots: {
        default: '<p>Content</p>',
      },
    });

    expect(wrapper.find('.v-card-text').classes()).toContain('pa-0');
  });
});
