declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module 'vue-markdown-render' {
  import type { DefineComponent } from 'vue';
  const VueMarkdown: DefineComponent<{
    source: string;
    options?: Record<string, unknown>;
  }>;
  export default VueMarkdown;
}

declare module 'vuedraggable' {
  import type { DefineComponent } from 'vue';
  const draggable: DefineComponent;
  export default draggable;
}
