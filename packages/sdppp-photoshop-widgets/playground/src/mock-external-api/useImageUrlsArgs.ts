import * as React from 'react';
import type { StoryObj } from '@storybook/react';

type StoryComponentProps<T> = T extends StoryObj<infer P> ? P : never;

/**
 * Hook that proxies Storybook args to local state so we can observe updates via updateArgs.
 */
export function useImageUrlsArgs(initial: string[]): [string[], (next: string[]) => void] {
  const [imageUrls, setImageUrls] = React.useState(initial);

  const handleUpdate = React.useCallback((next: string[]) => {
    setImageUrls(next);
  }, []);

  return [imageUrls, handleUpdate];
}


