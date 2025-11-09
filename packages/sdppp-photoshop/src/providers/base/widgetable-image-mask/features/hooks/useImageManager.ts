import { useCallback, useMemo } from 'react';
import { shiftSlotsAfterRemoval } from '../../foundation/utils/slot-management';
import { removeUrlAtIndex } from '../../services/upload/upload-helpers';
import type { UseImageManagerOptions, UseImageManagerReturn } from './image-manager-types';
import { useImageAutoSync } from './useImageAutoSync';
import { useImageComponentRegistration } from './useImageComponentRegistration';
import { useImageSync } from './useImageSync';

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

  const slots = useMemo(() => {
    const urlCount = Array.isArray(urls) ? urls.length : 0;
    const slotKeys = component?.slots ? Object.keys(component.slots) : [];
    const maxSlotIndex = slotKeys.length
      ? Math.max(...slotKeys.map(key => Number.parseInt(key, 10) || 0)) + 1
      : 0;
    const rawCount = maxCount === 1 ? 1 : Math.max(urlCount, maxSlotIndex, 1);
    const limit = Math.max(1, maxCount || 0);
    const count = Math.min(rawCount, limit);
    return Array.from({ length: count }, (_, index) => index);
  }, [component, urls, maxCount]);

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
