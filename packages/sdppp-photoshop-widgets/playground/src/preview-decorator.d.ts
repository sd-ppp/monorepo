import type { StoryContext } from '@storybook/react';

declare module '@storybook/react' {
  interface StoryContext {
    updateArgs?: (args: Record<string, unknown>) => void;
  }
}
