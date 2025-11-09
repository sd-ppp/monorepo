import { MutableRefObject, useCallback, useMemo } from 'react';
import { sdpppSDK } from '@sdppp/common';
import type { UploadPass } from '../../../../upload-pass-context';
import { SyncEvent, SyncType } from '../image-sync-types';
import {
  captureCurrentMask,
  captureWorkBoundaryImage,
  composeImageWithMask,
} from '../../services/photoshop/operations';
import { createSlotUploadPass } from '../../services/upload/upload-helpers';
import { GlobalImageStore } from '../../foundation/stores/global-image-store';
import { buildMaskContentUri } from '../../../realtime-thumbnail/utils';
interface SyncHandlerDeps {
  componentId: string;
  urlsRef: MutableRefObject<string[]>;
  onValueChange: (urls: string[]) => void;
  runUploadPassOnce: (pass: UploadPass) => Promise<string>;
  uploadResource: (resourceId: string, index: number) => void;
  setUploading: (value: boolean) => void;
  setUploadError: (value: string) => void;
}

type SyncHandler = (index: number, event: SyncEvent) => Promise<void>;

function useMaskCropSync({
  componentId,
  urlsRef,
  onValueChange,
  runUploadPassOnce,
  setUploading,
  setUploadError,
}: SyncHandlerDeps): SyncHandler {
  return useCallback(
    async (index: number) => {
      const uploadPass = createSlotUploadPass({
        componentId,
        index,
        urlsRef,
        onValueChange,
        logPrefix: 'Mask upload',
        setUploadingState: setUploading,
        setUploadError,
        captureResource: async () => {
          const slot = GlobalImageStore.getState().getSlot(componentId, index);
          if (!slot?.primaryResourceId) {
            const primaryCapture = await captureWorkBoundaryImage(componentId, index);
            if (!primaryCapture.resource) {
              throw new Error('Unable to capture primary image for masking');
            }
          }

          const maskCapture = await captureCurrentMask(componentId, index);
          if (!maskCapture.resource) {
            throw new Error('Missing mask resource from Photoshop');
          }

          // When user clicks selection mask, set maskUri to selection to enable realtime preview composition.
          try {
            const docIdRaw = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
            const docId = typeof docIdRaw === 'number' && Number.isFinite(docIdRaw) ? Math.max(0, Math.floor(docIdRaw)) : 0;
            const selectionMaskUri = buildMaskContentUri(docId, 'selection');
            GlobalImageStore.getState().setSlotMaskUri(componentId, index, selectionMaskUri as any);
          } catch (e) {
            // ignore maskUri set failure; do not introduce fallbacks here
          }

          const composite = await composeImageWithMask(componentId, index);
          if (!composite.resource) {
            throw new Error('Failed to compose image with mask');
          }

          try {
            const log = sdpppSDK.logger.extend('image-mask-upload');
            const slotAfter = GlobalImageStore.getState().getSlot(componentId, index);
            log('mask-crop-capture', {
              componentId,
              index,
              primaryResourceId: slotAfter?.primaryResourceId ?? null,
              maskResourceId: slotAfter?.maskResourceId ?? null,
              compositeResourceId: slotAfter?.compositeResourceId ?? null,
              returnedResource: composite.resource,
              willUploadComposite: composite.resource === slotAfter?.compositeResourceId,
            });
          } catch {}

          return composite.resource;
        },
      });

      runUploadPassOnce(uploadPass);
    },
    [componentId, onValueChange, runUploadPassOnce, setUploadError, setUploading, urlsRef]
  );
}

function usePrimarySync({
  componentId,
  uploadResource,
  setUploading,
}: SyncHandlerDeps): SyncHandler {
  return useCallback(
    async (index: number) => {
      setUploading(true);
      const capture = await captureWorkBoundaryImage(componentId, index);
      if (!capture.resource) {
        throw new Error('Missing resource from Photoshop');
      }
      // Do not mutate slot fileUri for primary sync; upload and let preview use uploaded URL or realtime
      uploadResource(capture.resource, index);
    },
    [componentId, setUploading, uploadResource]
  );
}

export function useSyncHandlers(deps: SyncHandlerDeps) {
  const maskCropSync = useMaskCropSync(deps);
  const primarySync = usePrimarySync(deps);

  const syncMap = useMemo<Record<SyncType, SyncHandler>>(
    () => ({
      maskCrop: maskCropSync,
      primary: primarySync,
    }),
    [maskCropSync, primarySync]
  );

  return useCallback(
    async (index: number, syncType: SyncType, event: SyncEvent) => {
      const handler = syncMap[syncType];
      if (!handler) {
        throw new Error(`Unsupported sync type: ${syncType}`);
      }
      await handler(index, event);
    },
    [syncMap]
  );
}
