import type { Args, StoryContext as BaseStoryContext } from '@storybook/react';

declare module '@storybook/react' {
  interface StoryContext<TArgs = Args> extends BaseStoryContext<TArgs> {
    updateArgs(args: Partial<TArgs>): void;
  }
}
