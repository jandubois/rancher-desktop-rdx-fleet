/**
 * Unit tests for the DividerCard component.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import DividerCard from './DividerCard.vue';

describe('DividerCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should render a simple divider without label', () => {
    const wrapper = mount(DividerCard);

    expect(wrapper.find('.divider-card').exists()).toBe(true);
    expect(wrapper.find('.v-divider').exists()).toBe(true);
    expect(wrapper.find('.labeled-divider').exists()).toBe(false);
  });

  it('should render a labeled divider when label is provided', () => {
    const wrapper = mount(DividerCard, {
      props: {
        settings: {
          label: 'Section Break',
        },
      },
    });

    expect(wrapper.find('.labeled-divider').exists()).toBe(true);
    expect(wrapper.find('.divider-label').text()).toBe('Section Break');
  });

  it('should apply default solid border style', () => {
    const wrapper = mount(DividerCard);

    const divider = wrapper.find('.v-divider');
    expect(divider.attributes('style')).toContain('border-style: solid');
  });

  it('should apply custom border style from settings', () => {
    const wrapper = mount(DividerCard, {
      props: {
        settings: {
          style: 'dashed',
        },
      },
    });

    const divider = wrapper.find('.v-divider');
    expect(divider.attributes('style')).toContain('border-style: dashed');
  });

  it('should render two dividers with label in between', () => {
    const wrapper = mount(DividerCard, {
      props: {
        settings: {
          label: 'Middle',
        },
      },
    });

    const dividers = wrapper.findAll('.v-divider');
    expect(dividers.length).toBe(2);
  });
});
