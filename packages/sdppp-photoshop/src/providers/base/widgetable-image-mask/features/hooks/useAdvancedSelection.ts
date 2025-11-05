import { useCallback } from 'react';
import { sdpppSDK } from '@sdppp/common';
import { GlobalImageStore, getSlotPrimaryConfig } from '../../foundation/stores/global-image-store';
import type { BoundarySetting } from '../../foundation/stores/types';
import { normalizeAdvancedContent } from '../../foundation/utils/slot-management';
import { resolveWorkBoundaryContext } from '../../services/photoshop/operations';

interface UseAdvancedSelectionOptions {
  componentId: string;
}

interface UseAdvancedSelectionResult {
  onAdvancedSelect: (index: number) => Promise<void>;
  onAdvancedCancel: (index: number) => void;
}

export function useAdvancedSelection({ componentId }: UseAdvancedSelectionOptions): UseAdvancedSelectionResult {
  const onAdvancedSelect = useCallback(
    async (index: number) => {
      const { boundaryParam } = resolveWorkBoundaryContext();
      const primaryBoundaryRect =
        typeof boundaryParam === 'object'
          ? boundaryParam
          : sdpppSDK.stores.WebviewStore.getState().workBoundaries?.[
              sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID
            ];

      if (!primaryBoundaryRect) {
        throw new Error('Unable to resolve primary boundary for selectImageSource');
      }

      const pickerResult = await sdpppSDK.plugins.photoshop.selectImageSource({
        additionalData: { primaryBoundaryRect },
      });
      if (!pickerResult || pickerResult.cancelled) {
        return;
      }

      if (pickerResult.action === 'getImage') {
        const params = pickerResult.params || {};
        const store = GlobalImageStore.getState();
        const slot = store.getSlot(componentId, index);
        const currentConfig = getSlotPrimaryConfig(slot);

        const content = normalizeAdvancedContent(params.content);
        let layerIdentify: string | null = params.layer_identify ?? currentConfig?.layerIdentify ?? null;

        if (!layerIdentify && (params.content === 'curlayer' || params.boundary === 'curlayer')) {
          try {
            const identify = await sdpppSDK.plugins.photoshop.getCurrentLayerIdentify({});
            if (identify?.layer_identify) {
              layerIdentify = identify.layer_identify;
            }
          } catch (error) {
            console.warn('selectImageSource getCurrentLayerIdentify failed:', error);
          }
        }

        const boundaryCandidate =
          (params as any).boundaryRect ?? params.boundary ?? primaryBoundaryRect ?? null;

        let boundarySetting: BoundarySetting =
          typeof boundaryCandidate === 'object' || typeof boundaryCandidate === 'string'
            ? (boundaryCandidate as BoundarySetting)
            : currentConfig?.boundary ?? null;

        if (boundarySetting === 'curlayer' && layerIdentify) {
          try {
            const info = await sdpppSDK.plugins.photoshop.getLayerInfo?.({ layer_identify: layerIdentify });
            const bounds = info?.boundary;
            if (bounds) {
              boundarySetting = {
                leftDistance: bounds.left ?? 0,
                topDistance: bounds.top ?? 0,
                rightDistance: bounds.right ?? 0,
                bottomDistance: bounds.bottom ?? 0,
                width: bounds.width ?? 0,
                height: bounds.height ?? 0,
              };
            }
          } catch (error) {
            console.warn('selectImageSource getLayerInfo failed:', error);
          }
        }

        const cropBySelection = params.cropBySelection === 'negative';

        store.setSlotPrimaryConfig(
          componentId,
          index,
          {
            type: currentConfig?.type ?? 'image',
            content,
            alt: cropBySelection,
            layerIdentify,
            boundary: boundarySetting ?? null,
          }
        );

        return;
      }

      if (pickerResult.action === 'pickLocalFile') {
        GlobalImageStore.getState().setSlotPrimaryConfig(componentId, index, null);
        throw new Error('Local file selection is currently disabled for this component');
      }

      throw new Error(`Unsupported image source action: ${String(pickerResult.action ?? '')}`);
    },
    [componentId]
  );

  const onAdvancedCancel = useCallback(
    (index: number) => {
      const slot = GlobalImageStore.getState().getSlot(componentId, index);
      const currentConfig = getSlotPrimaryConfig(slot);
      GlobalImageStore.getState().setSlotPrimaryConfig(componentId, index, currentConfig);
    },
    [componentId]
  );

  return {
    onAdvancedSelect,
    onAdvancedCancel,
  };
}
