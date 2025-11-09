import { useEffect } from 'react';
import { GlobalImageStore } from '../../foundation/stores/global-image-store';
import { useComponent } from '../../foundation/stores/hooks';
import type { ImageComponentState } from '../../foundation/stores/types';

interface UseImageComponentRegistrationOptions {
  componentId: string;
  maxCount: number;
  isMask: boolean;
  urls: string[];
}

export function useImageComponentRegistration({
  componentId,
  maxCount,
  isMask,
  urls,
}: UseImageComponentRegistrationOptions): ImageComponentState | undefined {
  useEffect(() => {
    GlobalImageStore.getState().registerComponent(componentId, {
      maxCount,
      isMask,
      urls,
    });

    return () => {
      GlobalImageStore.getState().unregisterComponent(componentId);
    };
  }, [componentId, maxCount, isMask]);

  useEffect(() => {
    const store = GlobalImageStore.getState();
    const currentComponent = store.components[componentId];

    if (
      currentComponent &&
      JSON.stringify(currentComponent.urls) !== JSON.stringify(urls)
    ) {
      GlobalImageStore.getState().updateUrls(componentId, urls);
    }
  }, [componentId, urls]);

  return useComponent(componentId);
}
