import React, { useCallback, useRef, useState } from 'react';
import { sdpppSDK } from '@sdppp/common';
import { useUploadPasses } from '../../upload-pass-context';
import { GlobalImageStore } from '../stores/global-image-store';
import {
  captureCurrentMask,
  captureWorkBoundaryImage,
  composeImageWithMask,
  createBlobUrl,
  createFileInput,
  DEFAULT_THUMBNAIL_SIZE,
  resolveWorkBoundaryContext,
  validateImageFile,
} from '../utils/image-operations';
import {
  createFileUploadPass,
  createResourceUploadPass,
  updateUrlsAtIndex,
  isAbortError,
} from '../utils/upload-helpers';

export interface SyncEvent {
  altKey: boolean;
  shiftKey: boolean;
}

export interface UseImageSyncOptions {
  componentId: string;
  urls: string[];
  isMask: boolean;
  onValueChange: (urls: string[]) => void;
}

type SyncType = 'primary' | 'maskCrop' | 'disk' | 'sourcePicker' | 'advancedResync';

export function useImageSync({
  componentId,
  urls,
  isMask: _isMask,
  onValueChange,
}: UseImageSyncOptions) {
  const { runUploadPassOnce } = useUploadPasses();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const urlsRef = useRef<string[]>(urls || []);

  React.useEffect(() => {
    urlsRef.current = urls || [];
  }, [urls]);

  const uploadResource = useCallback(
    (resourceId: string, index: number) => {
      const uploadPass = createResourceUploadPass(
        resourceId,
        `${Date.now()}.png`,
        'image/png',
        (finalUrl: string) => {
          const next = updateUrlsAtIndex(urlsRef.current, index, finalUrl);
          onValueChange(next);
          setUploading(false);
        },
        (error: any) => {
          if (!isAbortError(error)) {
            console.warn('Photoshop upload failed:', error);
            setUploadError(error?.message || String(error));
          }
          setUploading(false);
        }
      );
      runUploadPassOnce(uploadPass);
    },
    [onValueChange, runUploadPassOnce]
  );

  const handleLocalFileSelection = useCallback(
    (file: File, index: number) => {
      if (!validateImageFile(file)) {
        console.warn('Only image files are allowed');
        return;
      }

      setUploading(true);
      const blobUrl = createBlobUrl(file);
      GlobalImageStore.getState().setSlotThumbnail(componentId, index, blobUrl);
      GlobalImageStore.getState().registerBlob(blobUrl);

      const uploadPass = createFileUploadPass(
        file,
        (finalUrl: string) => {
          const next = updateUrlsAtIndex(urlsRef.current, index, finalUrl);
          onValueChange(next);
          setUploading(false);
        },
        (error: any) => {
          if (!isAbortError(error)) {
            console.warn('Disk upload failed:', error);
            setUploadError(error?.message || String(error));
          }
          setUploading(false);
        }
      );

      runUploadPassOnce(uploadPass);
    },
    [componentId, onValueChange, runUploadPassOnce, setUploadError]
  );

  const onSync = useCallback(
    async (index: number, syncType: SyncType, _event: SyncEvent) => {
      try {
        setUploadError('');

        if (syncType === 'disk') {
          createFileInput(file => handleLocalFileSelection(file, index));
          return;
        }

        if (syncType === 'sourcePicker') {
          const { boundaryParam, imageSize } = resolveWorkBoundaryContext();
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
            setUploading(true);
            const params = {
              imageQuality: 1,
              cropBySelection: 'no',
              imageSize,
              ...(pickerResult.params || {}),
            } as any;

            const response = await sdpppSDK.plugins.photoshop.getImage(params);
            if (!response?.resource) {
              throw new Error('Failed to capture image from Photoshop');
            }

            GlobalImageStore.getState().setSlotAdvancedSelection(componentId, index, {
              action: 'getImage',
              params,
            });
            GlobalImageStore.getState().setSlotAdvancedAutoEnabled(componentId, index, false);

            GlobalImageStore.getState().setSlotPrimaryResource(componentId, index, response.resource);
            if (response.thumbnail) {
              GlobalImageStore.getState().setSlotThumbnail(componentId, index, response.thumbnail);
            } else {
              try {
                const thumbRes = await sdpppSDK.plugins.photoshop.getThumbnail({
                  resource: response.resource,
                  maxSize: DEFAULT_THUMBNAIL_SIZE,
                });
                if (thumbRes?.thumbnail) {
                  GlobalImageStore.getState().setSlotThumbnail(componentId, index, thumbRes.thumbnail);
                }
              } catch (thumbError) {
                console.warn('selectImageSource thumbnail fetch failed:', thumbError);
              }
            }
            GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);

            uploadResource(response.resource, index);
            return;
          }

          if (pickerResult.action === 'pickLocalFile') {
            GlobalImageStore.getState().setSlotAdvancedSelection(componentId, index, {
              action: 'pickLocalFile',
              params: pickerResult.params || {},
            });
            GlobalImageStore.getState().setSlotAdvancedAutoEnabled(componentId, index, false);

            const acceptValue = pickerResult.params?.accept;
            const accept = Array.isArray(acceptValue)
              ? acceptValue.join(',')
              : acceptValue;
            createFileInput(
              file => handleLocalFileSelection(file, index),
              typeof accept === 'string' && accept.trim().length ? accept : 'image/*'
            );
            return;
          }

          throw new Error(`Unsupported image source action: ${String(pickerResult.action ?? '')}`);
        }

        if (syncType === 'advancedResync') {
          const slot = GlobalImageStore.getState().getSlot(componentId, index);
          const advanced = slot?.advancedSelection;
          if (!advanced) {
            await onSync(index, 'sourcePicker', _event);
            return;
          }

          if (advanced.action === 'getImage') {
            setUploading(true);
            const { imageSize } = resolveWorkBoundaryContext();
            const baseParams = advanced.params || {};
            const params = {
              ...baseParams,
              imageSize: typeof imageSize === 'number' ? imageSize : baseParams.imageSize,
              imageQuality: baseParams.imageQuality ?? 1,
              cropBySelection: baseParams.cropBySelection ?? 'no',
            } as any;

            const response = await sdpppSDK.plugins.photoshop.getImage(params);
            if (!response?.resource) {
              throw new Error('Failed to capture image from Photoshop');
            }

            GlobalImageStore.getState().setSlotPrimaryResource(componentId, index, response.resource);
            if (response.thumbnail) {
              GlobalImageStore.getState().setSlotThumbnail(componentId, index, response.thumbnail);
            } else {
              try {
                const thumbRes = await sdpppSDK.plugins.photoshop.getThumbnail({
                  resource: response.resource,
                  maxSize: DEFAULT_THUMBNAIL_SIZE,
                });
                if (thumbRes?.thumbnail) {
                  GlobalImageStore.getState().setSlotThumbnail(componentId, index, thumbRes.thumbnail);
                }
              } catch (thumbError) {
                console.warn('advancedResync thumbnail fetch failed:', thumbError);
              }
            }
            GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);
            GlobalImageStore.getState().setSlotAdvancedSelection(componentId, index, {
              action: 'getImage',
              params,
            });

            uploadResource(response.resource, index);
            return;
          }

          if (advanced.action === 'pickLocalFile') {
            const acceptValue = advanced.params?.accept;
            const accept = Array.isArray(acceptValue)
              ? acceptValue.join(',')
              : acceptValue;
            createFileInput(
              file => handleLocalFileSelection(file, index),
              typeof accept === 'string' && accept.trim().length ? accept : 'image/*'
            );
            return;
          }

          return;
        }

        if (syncType === 'primary') {
          setUploading(true);
          const capture = await captureWorkBoundaryImage(componentId, index);
          if (!capture.resource) {
            throw new Error('Missing resource from Photoshop');
          }
          uploadResource(capture.resource, index);
          return;
        }

        if (syncType === 'maskCrop') {
          setUploading(true);

          const uploadPass = {
            getUploadFile: async (signal?: AbortSignal) => {
              if (signal?.aborted) {
                throw new DOMException('Upload aborted', 'AbortError');
              }

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

              const composite = await composeImageWithMask(componentId, index);
              if (!composite.resource) {
                throw new Error('Failed to compose image with mask');
              }

              return {
                type: 'resource' as const,
                resource: composite.resource,
                fileName: `${Date.now()}.png`,
                mimeType: 'image/png',
              };
            },
            onUploaded: async (finalUrl: string) => {
              const next = updateUrlsAtIndex(urlsRef.current, index, finalUrl);
              onValueChange(next);
              setUploading(false);
            },
            onUploadError: (error: any) => {
              if (!isAbortError(error)) {
                console.warn('Mask upload failed:', error);
                setUploadError(error?.message || String(error));
              }
              setUploading(false);
            },
          };

          runUploadPassOnce(uploadPass);
          return;
        }
      } catch (error) {
        setUploading(false);
        console.warn('onSync error:', error);
        setUploadError((error as any)?.message || String(error));
      }
    },
    [componentId, uploadResource, handleLocalFileSelection, onValueChange, runUploadPassOnce]
  );

  return { onSync, uploading, uploadError };
}
