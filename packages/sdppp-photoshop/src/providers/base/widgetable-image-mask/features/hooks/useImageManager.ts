import { useCallback } from 'react';
import { shiftSlotsAfterRemoval } from '../../foundation/utils/slot-management';
import { removeUrlAtIndex } from '../../services/upload/upload-helpers';
import type { UseImageManagerOptions, UseImageManagerReturn } from './image-manager-types';
import { useImageAutoSync } from './useImageAutoSync';
import { useImageComponentRegistration } from './useImageComponentRegistration';
import { useImageSync } from './useImageSync';
import { useSlotsViewModel } from './useSlotsViewModel';

export function useImageManager({
  componentId,
  maxCount,
  isMask,
  urls,
  onValueChange,
}: UseImageManagerOptions): UseImageManagerReturn {
  const component = useImageComponentRegistration({
    componentId,
    maxCount,
    isMask,
    urls,
  });

  const { slots } = useSlotsViewModel({
    componentId,
    maxCount,
    urls,
    component,
  });

  const { onSync, onAdvancedSelect, onAdvancedCancel, uploading, uploadError } = useImageSync({
    componentId,
    urls,
    isMask,
    onValueChange,
  });

  const { setPrimaryAuto, setMaskAuto } = useImageAutoSync({
    componentId,
    urls,
    isMask,
    onValueChange,
  });

  const onAdd = useCallback(() => {
    if (maxCount === 1) return;
    const limit = Math.max(1, maxCount || 0);
    const curr = urls || [];
    if (curr.length >= limit) return;
    const next = [...curr, ''];
    onValueChange(next);
  }, [urls, maxCount, onValueChange]);

  const onRemove = useCallback(
    (index: number) => {
      const curr = urls || [];
      if (curr.length <= 1 && maxCount === 1) {
        const next = [...curr];
        if (!next.length) {
          onValueChange(['']);
          return;
        }
        next[index] = '';
        onValueChange(next);
        return;
      }

      try {
        shiftSlotsAfterRemoval(componentId, index);
      } catch (error) {
        console.warn('[useImageManager] onRemove shift failed', error);
      }

      const next = removeUrlAtIndex(curr, index);
      onValueChange(next);
    },
    [urls, maxCount, onValueChange, componentId],
  );

  const handlePrimarySync = useCallback(
    async (index: number) => {
      await onSync(index, 'primary', { altKey: false, shiftKey: false });
    },
    [onSync],
  );

  const handleMaskSync = useCallback(
    async (index: number) => {
      await onSync(index, 'maskCrop', { altKey: false, shiftKey: false });
    },
    [onSync],
  );

  const handlePrimaryAutoToggle = useCallback(
    (index: number, enable: boolean) => {
      void setPrimaryAuto(index, enable);
    },
    [componentId, setPrimaryAuto],
  );

  const handleMaskAutoToggle = useCallback(
    (index: number, enable: boolean) => {
      void setMaskAuto(index, enable);
    },
    [setMaskAuto],
  );

  const showAddRemove = maxCount !== 1;

  return {
    slots,
    onPrimarySync: handlePrimarySync,
    onMaskSync: handleMaskSync,
    onAdvancedSelect,
    onAdvancedCancel,
    onPrimaryAutoToggle: handlePrimaryAutoToggle,
    onMaskAutoToggle: handleMaskAutoToggle,
    onAdd,
    onRemove,
    uploading,
    uploadError,
    showAddRemove,
  };
}
