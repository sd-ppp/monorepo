import { sdpppSDK } from '@sdppp/common';
import { useTranslation } from '@sdppp/common/i18n/react';
import type { ButtonConfig, ImageSyncGroupData } from '@sdppp/ui-library';
import React, { useCallback, useEffect, useMemo } from 'react';
import { GlobalImageStore, useComponent } from '../stores/global-image-store';
import { RealtimeThumbnailStore } from '../stores/realtime-thumbnail-store';
import { removeUrlAtIndex } from '../utils/upload-helpers';
import { useImageAutoSync, type AutoSyncEvent } from './useImageAutoSync';
import { useImageSync, type SyncEvent } from './useImageSync';

export interface UseImageManagerOptions {
  componentId: string;
  maxCount: number;
  isMask: boolean;
  urls: string[];
  onValueChange: (urls: string[]) => void;
}

export interface UseImageManagerReturn {
  // UI Data
  groups: ImageSyncGroupData[];
  buttons: ButtonConfig[];

  // Actions
  onSync: (index: number, syncType: string, event: SyncEvent) => Promise<void>;
  onAutoSync: (index: number, autoSyncId: string | null, event: AutoSyncEvent) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;

  // State
  uploading: boolean;
  uploadError: string;
  showAddRemove: boolean;
}

// Hook to track Alt key state globally
function useAltKeyState(): boolean {
  const [altActive, setAltActive] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.getModifierState?.('Alt')) {
        setAltActive(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || !e.altKey) {
        setAltActive(false);
      }
    };
    const handleBlur = () => setAltActive(false);

    document.body.addEventListener('keydown', handleKeyDown);
    document.body.addEventListener('keyup', handleKeyUp);
    document.body.addEventListener('blur', handleBlur);
    return () => {
      document.body.removeEventListener('keydown', handleKeyDown);
      document.body.removeEventListener('keyup', handleKeyUp);
      document.body.removeEventListener('blur', handleBlur);
    };
  }, []);

  return altActive;
}

function useButtonConfigs(isMask: boolean, altActive: boolean): ButtonConfig[] {
  const { t } = useTranslation();

  return useMemo(() => {
    const canvasSyncTooltip = t('image.upload.tooltip.image.canvas') + '\n' + t('image.upload.tooltip.alt.crop');
    const curlayerSyncTooltip = isMask
      ? t('image.upload.tooltip.mask.curlayer') + '\n' + t('image.upload.tooltip.alt.reverse')
      : t('image.upload.tooltip.image.curlayer') + '\n' + t('image.upload.tooltip.alt.crop');
    const selectionSyncTooltip = t('image.upload.tooltip.mask.selection') + '\n' + t('image.upload.tooltip.alt.reverse');

    const altDescMask = altActive ? '(reversed)' : undefined;
    const altDescImage = altActive ? '(selection)' : undefined;

    if (isMask) {
      return [
        {
          id: 'selection',
          text: t('image.upload.from_selection', { defaultMessage: 'Selection' }),
          descText: altDescMask,
          supportsAutoSync: true,
          syncButtonTooltip: selectionSyncTooltip,
          autoSyncButtonTooltips: {
            enabled: t('image.upload.tooltip.autosync.on') + '\n' + selectionSyncTooltip,
            disabled: t('image.upload.tooltip.autosync.off') + '\n' + selectionSyncTooltip,
          },
        },
        {
          id: 'curlayer',
          text: t('image.upload.from_curlayer', { defaultMessage: 'Current Layer' }),
          descText: altDescMask,
          supportsAutoSync: true,
          syncButtonTooltip: curlayerSyncTooltip,
          autoSyncButtonTooltips: {
            enabled: t('image.upload.tooltip.autosync.on') + '\n' + curlayerSyncTooltip,
            disabled: t('image.upload.tooltip.autosync.off') + '\n' + curlayerSyncTooltip,
          },
        },
        {
          id: 'canvas',
          text: t('image.upload.from_canvas', { defaultMessage: 'Canvas' }),
          descText: altDescMask,
          supportsAutoSync: false,
          syncButtonTooltip: t('image.upload.tooltip.mask.canvas'),
        },
      ];
    }

    return [
      {
        id: 'canvas',
        text: t('image.upload.from_canvas', { defaultMessage: 'Canvas' }),
        descText: altDescImage,
        supportsAutoSync: true,
        syncButtonTooltip: canvasSyncTooltip,
        autoSyncButtonTooltips: {
          enabled: t('image.upload.tooltip.autosync.on') + '\n' + canvasSyncTooltip,
          disabled: t('image.upload.tooltip.autosync.off') + '\n' + canvasSyncTooltip,
        },
      },
      {
        id: 'curlayer',
        text: t('image.upload.from_curlayer', { defaultMessage: 'Current Layer' }),
        descText: altDescImage,
        supportsAutoSync: true,
        syncButtonTooltip: curlayerSyncTooltip,
        autoSyncButtonTooltips: {
          enabled: t('image.upload.tooltip.autosync.on') + '\n' + curlayerSyncTooltip,
          disabled: t('image.upload.tooltip.autosync.off') + '\n' + curlayerSyncTooltip,
        },
      },
      {
        id: 'disk',
        text: t('image.upload.from_harddisk'),
        supportsAutoSync: false,
        syncButtonTooltip: '',
      },
    ];
  }, [isMask, altActive, t]);
}

const MAX_LAYER_LABEL_LENGTH = 24;

const formatLayerDisplay = (identify: string) => {
  if (!identify) return '';
  const match = identify.match(/^(.*?)(?:\s*\(id:\d+\))?$/);
  const rawName = match ? match[1] : identify;
  const cleaned = rawName.replace(/^[-\s]+/, '').trim();
  if (cleaned.length <= MAX_LAYER_LABEL_LENGTH) {
    return cleaned;
  }
  return `${cleaned.slice(0, MAX_LAYER_LABEL_LENGTH - 1)}…`;
};

export function useImageManager({
  componentId,
  maxCount,
  isMask,
  urls,
  onValueChange,
}: UseImageManagerOptions): UseImageManagerReturn {
<<<<<<< HEAD
  const altActive = useAltKeyState();
  const buttons = useButtonConfigs(isMask, altActive);
=======
  const { t } = useTranslation();
  const buttons = useButtonConfigs(isMask);
>>>>>>> 4ab3381 (sync back bugfix & layer watch)

  // Register component in store
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

  // Update URLs when they change - with infinite loop prevention
  useEffect(() => {
    const store = GlobalImageStore.getState();
    const currentComponent = store.components[componentId];

    // Only update if URLs actually changed to prevent infinite loops
    if (currentComponent && JSON.stringify(currentComponent.urls) !== JSON.stringify(urls)) {
      GlobalImageStore.getState().updateUrls(componentId, urls);
    }
  }, [componentId, urls]);

  // Get component state and real-time thumbnails
  const comp = useComponent(componentId);
  const docId = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
  const thumbs = RealtimeThumbnailStore(state => state.thumbsByDoc[docId || 0]);

  // Calculate group count
  const groupCount = useMemo(() => {
    if (maxCount === 1) return 1;
    return Math.max(urls?.length || 0, 1);
  }, [urls, maxCount]);

  // Build groups data for UI
  const groups: ImageSyncGroupData[] = useMemo(() => {
    const arr: ImageSyncGroupData[] = [];
    for (let i = 0; i < groupCount; i++) {
      const slot = comp?.slots?.[i];
      const activeId = slot?.auto?.content || null;
      let key: string | null = null;
      if (activeId) {
        const base = slot?.auto?.layerIdentify ? `${activeId}:${slot.auto.layerIdentify}` : activeId;
        key = slot?.auto?.alt ? `${base}_alt` : base;
      }
      const rt = key ? (comp?.isMask ? (thumbs as any)?.mask?.[key] : (thumbs as any)?.image?.[key]) : '';
      const fallback = urls?.[i] || '';

      const slotButtons = buttons.map(btn => {
        if (btn.id === 'curlayer') {
          const isActive = slot?.auto?.content === 'curlayer';
          const layerIdentifyRaw = slot?.auto?.layerIdentify || '';
          if (isActive && layerIdentifyRaw) {
            const label = formatLayerDisplay(layerIdentifyRaw);
            return {
              ...btn,
              text: label,
            };
          }
          return btn;
        }

        if (btn.id === 'canvas') {
          const isCanvasActive = slot?.auto?.content === 'canvas';
          if (isCanvasActive) {
            return {
              ...btn,
              descText: t('image.upload.autosync.fetching', { defaultValue: 'Auto fetching…' }),
            };
          }
        }

        return btn;
      });

      arr.push({
        buttons: slotButtons,
        imageUrl: rt || slot?.thumbnail || fallback,
        activeAutoSyncId: activeId,
      });
    }
    return arr;
  }, [comp, groupCount, urls, buttons, thumbs, t]);

  // Sync and auto-sync hooks
  const { onSync, uploading, uploadError } = useImageSync({
    componentId,
    urls,
    isMask,
    onValueChange,
  });

  const { onAutoSyncChange } = useImageAutoSync({
    componentId,
    urls,
    isMask,
    onValueChange,
  });

  // Add new slot
  const onAdd = useCallback(() => {
    if (maxCount === 1) return; // single style
    const limit = Math.max(1, maxCount || 0);
    const curr = urls || [];
    if (curr.length >= limit) return;
    const next = [...curr, ''];
    onValueChange(next);
  }, [urls, maxCount, onValueChange]);

  // Remove slot
  const onRemove = useCallback(
    (index: number) => {
      const curr = urls || [];
      if (curr.length <= 1 && maxCount === 1) {
        // single style: clear content but keep one slot
        const next = [...curr];
        if (!next.length) {
          onValueChange(['']);
          return;
        }
        next[index] = '';
        onValueChange(next);
        return;
      }

      // Shift GlobalImageStore slot states down to keep indices aligned after removal
      try {
        const compState = GlobalImageStore.getState().components[componentId];
        const slotKeys = Object.keys(compState?.slots || {})
          .map(k => parseInt(k, 10))
          .filter(n => !Number.isNaN(n))
          .sort((a, b) => a - b);

        for (const k of slotKeys) {
          if (k < index) continue;
          const src = compState?.slots?.[k + 1];
          if (src) {
            GlobalImageStore.getState().setSlotAuto(componentId, k, src.auto || null);
            GlobalImageStore.getState().setSlotThumbnail(componentId, k, src.thumbnail);
            GlobalImageStore.getState().setSlotUploading(componentId, k, !!src.uploading, src.uploadId || null);
          } else {
            GlobalImageStore.getState().clearSlot(componentId, k);
          }
        }
      } catch {}

      const next = removeUrlAtIndex(curr, index);
      onValueChange(next);
    },
    [urls, maxCount, onValueChange, componentId]
  );

  const showAddRemove = maxCount !== 1;

  return {
    groups,
    buttons,
    onSync,
    onAutoSync: onAutoSyncChange,
    onAdd,
    onRemove,
    uploading,
    uploadError,
    showAddRemove,
  };
}
