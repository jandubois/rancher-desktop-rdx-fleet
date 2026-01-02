/**
 * Unit tests for the ImageCard component.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ImageCard from './ImageCard.vue';

// Mock CardWrapper
vi.mock('./CardWrapper.vue', () => ({
  default: {
    name: 'CardWrapper',
    template: '<div class="mock-card-wrapper"><slot /></div>',
    props: ['title', 'noPadding'],
  },
}));

describe('ImageCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should render image from URL', () => {
    const wrapper = mount(ImageCard, {
      props: {
        title: 'Test Image',
        settings: {
          src: 'https://example.com/image.png',
        },
      },
    });

    const img = wrapper.find('.v-img');
    expect(img.exists()).toBe(true);
  });

  it('should render image from bundled data', () => {
    const wrapper = mount(ImageCard, {
      props: {
        settings: {
          bundledImage: {
            data: 'base64data',
            mimeType: 'image/png',
          },
        },
      },
    });

    const img = wrapper.find('.v-img');
    expect(img.exists()).toBe(true);
  });

  it('should show empty state when no image is configured', () => {
    const wrapper = mount(ImageCard, {
      props: {
        settings: {},
      },
    });

    expect(wrapper.find('.no-image').exists()).toBe(true);
    expect(wrapper.text()).toContain('No image configured');
  });

  it('should show empty state when settings is undefined', () => {
    const wrapper = mount(ImageCard);

    expect(wrapper.find('.no-image').exists()).toBe(true);
  });

  it('should use alt text from settings', () => {
    const wrapper = mount(ImageCard, {
      props: {
        settings: {
          src: 'https://example.com/image.png',
          alt: 'Custom alt text',
        },
      },
    });

    const img = wrapper.findComponent({ name: 'VImg' });
    expect(img.props('alt')).toBe('Custom alt text');
  });

  it('should use title as alt text when alt is not provided', () => {
    const wrapper = mount(ImageCard, {
      props: {
        title: 'Image Title',
        settings: {
          src: 'https://example.com/image.png',
        },
      },
    });

    const img = wrapper.findComponent({ name: 'VImg' });
    expect(img.props('alt')).toBe('Image Title');
  });

  it('should default to "Image" as alt text', () => {
    const wrapper = mount(ImageCard, {
      props: {
        settings: {
          src: 'https://example.com/image.png',
        },
      },
    });

    const img = wrapper.findComponent({ name: 'VImg' });
    expect(img.props('alt')).toBe('Image');
  });

  it('should prefer bundled image over URL', () => {
    const wrapper = mount(ImageCard, {
      props: {
        settings: {
          src: 'https://example.com/image.png',
          bundledImage: {
            data: 'base64data',
            mimeType: 'image/jpeg',
          },
        },
      },
    });

    const img = wrapper.findComponent({ name: 'VImg' });
    expect(img.props('src')).toBe('data:image/jpeg;base64,base64data');
  });
});
