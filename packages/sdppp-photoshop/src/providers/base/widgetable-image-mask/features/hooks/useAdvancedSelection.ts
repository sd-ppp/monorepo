import { useCallback } from 'react';
import { sdpppSDK } from '@sdppp/common';
import { GlobalImageStore } from '../../foundation/stores/global-image-store';
import { buildBoundaryUri } from '../../../realtime-thumbnail/utils';
import { useUploadPasses } from '../../../upload-pass-context';
import { createResourceUploadPass, updateUrlsAtIndex } from '../../services/upload/upload-helpers';
import { getSlotPrimaryConfig } from '../../foundation/stores/types';
import type { SlotState, TrackType } from '../../foundation/stores/types';
import { resolveWorkBoundaryContext } from '../../services/photoshop/operations';

interface UseAdvancedSelectionOptions {
  componentId: string;
}

interface UseAdvancedSelectionResult {
  onAdvancedSelect: (index: number) => Promise<void>;
  onAdvancedCancel: (index: number) => void;
}

export function useAdvancedSelection({ componentId }: UseAdvancedSelectionOptions): UseAdvancedSelectionResult {
  const { runUploadPassOnce } = useUploadPasses();
  const onAdvancedSelect = useCallback(
    async (index: number) => {
      const activeDocumentID = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
      const webviewState: any = sdpppSDK.stores.WebviewStore.getState();
      const workBoundaries = webviewState?.workBoundaries || {};
      const primaryBoundaryRect = workBoundaries[activeDocumentID];


      if (!primaryBoundaryRect || typeof primaryBoundaryRect !== 'object') {
        throw new Error('Unable to resolve primary boundary for selectImageSource');
      }

      const boundaryResource = buildBoundaryUri(activeDocumentID, primaryBoundaryRect as any);
      const pickerResult = await sdpppSDK.plugins.photoshop.selectImageSource({
        additionalData: { boundaryResource },
      });
      if (!pickerResult || pickerResult.cancelled) {
        return;
      }

      if (pickerResult.mode === 'image') {
        const { contentResource, boundaryResource: outBoundary } = pickerResult;
        if (!contentResource || !outBoundary) {
          throw new Error('Advanced selection must include boundaryResource and contentResource');
        }

        applyAdvancedSelection({
          componentId,
          index,
          boundaryResource: outBoundary,
          contentResource,
          fileResource: null,
        });

        return;
      }

      if (pickerResult.mode === 'file') {
        const pick = await sdpppSDK.plugins.photoshop.pickLocalFile({ kind: 'image' });
        if (!pick || pick.cancelled || !pick.resource) {
          throw new Error('File selection returned empty resource');
        }
        // Set file token for immediate preview
        GlobalImageStore.getState().setSlotFileUri(componentId, index, pick.resource as string);
        // Kick off upload pass to produce final URL
        const pass = createResourceUploadPass(
          pick.resource as string,
          `${Date.now()}.png`,
          (pick.mimeType as string) || 'image/png',
          (finalUrl: string) => {
            const comp = GlobalImageStore.getState().getComponent(componentId);
            const curr = comp?.urls || [];
            const next = updateUrlsAtIndex(curr, index, finalUrl);
            GlobalImageStore.getState().updateUrls(componentId, next);
            // 保留 fileUri 优先用于预览；不清理临时 token
          },
          (error: any) => {
            console.warn('[useAdvancedSelection] upload error', error);
          }
        );
        try {
          console.log('[useAdvancedSelection] start upload pass', { componentId, index, resource: pick.resource });
          await runUploadPassOnce(pass);
          console.log('[useAdvancedSelection] upload pass queued');
        } catch (e) {
          console.warn('[useAdvancedSelection] runUploadPassOnce failed', e);
        }
        return;
      }

      throw new Error(`Unsupported image source mode: ${String((pickerResult as any).mode ?? '')}`);
    },
    [componentId, runUploadPassOnce]
  );

  const onAdvancedCancel = useCallback(
    (index: number) => {
      // Clear advanced selection: remove all URIs so the button returns to "修改" state.
      GlobalImageStore.getState().setSlotPrimaryConfig(componentId, index, null);
    },
    [componentId]
  );

  return {
    onAdvancedSelect,
    onAdvancedCancel,
  };
}

function applyAdvancedSelection({
  componentId,
  index,
  boundaryResource,
  contentResource,
  fileResource,
}: {
  componentId: string;
  index: number;
  boundaryResource: string | null;
  contentResource: string | null;
  fileResource: string | null;
}) {
  const store = GlobalImageStore.getState();
  if (fileResource) {
    store.setSlotPrimaryConfig(componentId, index, null);
    store.setSlotFileUri(componentId, index, fileResource);
    return;
  }

  if (!boundaryResource || !contentResource) {
    throw new Error('Advanced selection requires both boundaryResource and contentResource');
  }
  store.setSlotBoundaryUri(componentId, index, boundaryResource as any);
  store.setSlotContentUri(componentId, index, contentResource as any);
  store.setSlotMaskUri(componentId, index, null as any);
  store.setSlotFileUri(componentId, index, null);
}
