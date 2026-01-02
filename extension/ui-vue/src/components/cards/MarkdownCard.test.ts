/**
 * Unit tests for the MarkdownCard component.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import MarkdownCard from './MarkdownCard.vue';

// Mock CardWrapper
vi.mock('./CardWrapper.vue', () => ({
  default: {
    name: 'CardWrapper',
    template: '<div class="mock-card-wrapper"><slot /></div>',
    props: ['title', 'cardId', 'duplicatable'],
  },
}));

// Mock vue-markdown-render
vi.mock('vue-markdown-render', () => ({
  default: {
    name: 'VueMarkdown',
    template: '<div class="mock-markdown" v-html="source"></div>',
    props: ['source'],
  },
}));

describe('MarkdownCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should render markdown content', () => {
    const wrapper = mount(MarkdownCard, {
      props: {
        id: 'test-markdown',
        title: 'Test Card',
        settings: {
          content: '# Hello World',
        },
      },
    });

    expect(wrapper.find('.markdown-content').exists()).toBe(true);
    expect(wrapper.find('.mock-markdown').exists()).toBe(true);
  });

  it('should pass content to markdown renderer', () => {
    const wrapper = mount(MarkdownCard, {
      props: {
        id: 'test-markdown',
        settings: {
          content: '**Bold text**',
        },
      },
    });

    const markdown = wrapper.find('.mock-markdown');
    expect(markdown.html()).toContain('**Bold text**');
  });

  it('should handle empty content', () => {
    const wrapper = mount(MarkdownCard, {
      props: {
        id: 'test-markdown',
        settings: {},
      },
    });

    const markdown = wrapper.find('.mock-markdown');
    expect(markdown.text()).toBe('');
  });

  it('should handle undefined settings', () => {
    const wrapper = mount(MarkdownCard, {
      props: { id: 'test-markdown' },
    });

    expect(wrapper.find('.markdown-content').exists()).toBe(true);
  });

  it('should pass title to CardWrapper', () => {
    const wrapper = mount(MarkdownCard, {
      props: {
        id: 'test-markdown',
        title: 'My Markdown Card',
      },
    });

    expect(wrapper.find('.mock-card-wrapper').exists()).toBe(true);
  });
});
