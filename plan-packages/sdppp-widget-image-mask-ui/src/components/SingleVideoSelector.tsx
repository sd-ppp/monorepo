import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagePreviewSplitList } from '@sdppp/ui-library';
import { Button } from 'antd';
import { Plus } from 'lucide-react';
import { useWidgetImageMaskActions, useWidgetText } from '../context/WidgetImageMaskContext';
import { UploadableImagePreviewSplit } from './shared/UploadableImagePreviewSplit';

export const SingleVideoSelector: React.FC<{
  widgetableId: string;
  value: string[];
  onValueChange?: (value: string[]) => void;
}> = ({ widgetableId, value = [], onValueChange }) => {
  const actions = useWidgetImageMaskActions();
  const t = useWidgetText();
  const [preview, setPreview] = useState<string>(value?.[0] ?? '');
  const [pendingUploads, setPendingUploads] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const emitValue = useCallback(
    (next: string[]) => {
      if (!onValueChange) return;
      onValueChange(next);
    },
    [onValueChange],
  );

  const markUploadStart = useCallback(() => {
    setPendingUploads(prev => prev + 1);
    setUploadError(null);
  }, []);

  const markUploadEnd = useCallback(() => {
    setPendingUploads(prev => (prev <= 1 ? 0 : prev - 1));
  }, []);

  const uploading = pendingUploads > 0;
  const uploadStatus = uploadError ? 'error' : uploading ? 'uploading' : 'idle';

  useEffect(() => {
    const incoming = value?.[0] ?? '';
    setPreview(prev => (incoming !== prev ? incoming : prev));
  }, [value]);

  const handleAddFromFile = useCallback(async () => {
    markUploadStart();
    try {
      const createResult = await actions['resource.file.createFromLocal']();
      if (!createResult || createResult.error) {
        const message =
          (typeof createResult?.error === 'string' && createResult.error.trim().length
            ? createResult.error.trim()
            : t('image.upload.error', { defaultValue: '上传失败，请重试' }));
        setUploadError(message);
        return;
      }
      const resource = createResult.resource;
      if (!resource) {
        setUploadError(t('image.upload.error', { defaultValue: '上传失败，请重试' }));
        return;
      }
      const inlineThumb = createResult.thumbnail;
      if (inlineThumb) {
        setPreview(inlineThumb);
        emitValue([resource]);
        return;
      }
      const thumbResult = await actions['resource.thumbnail']({ resource });
      setPreview(thumbResult?.thumbnail ?? resource);
      emitValue([resource]);
      setUploadError(null);
    } catch (err) {
      // swallow errors for demo
      const message =
        err instanceof Error && err.message
          ? err.message
          : t('image.upload.error', { defaultValue: '上传失败，请重试' });
      setUploadError(message);
    } finally {
      markUploadEnd();
    }
  }, [actions, emitValue, markUploadStart, markUploadEnd, t]);

  const items = useMemo(() => {
    const leftNode = (
      <div style={{ display: 'flex', flexDirection: 'column', width: 160 }}>
        <Button
          type="dashed"
          block
          style={{ height: 100, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          icon={<Plus size={16} strokeWidth={2} />}
          onClick={() => { void handleAddFromFile(); }}
        >
          添加视频
        </Button>
      </div>
    );

    return [
      <UploadableImagePreviewSplit
        key={`single-video-${widgetableId}`}
        left={leftNode}
        imageUrl={preview}
        background="checkerboard"
        uploadStatus={uploadStatus}
        uploadIndicatorErrorMessage={uploadError ?? undefined}
        onUploadDismiss={
          uploadError
            ? () => {
                setUploadError(null);
              }
            : undefined
        }
      />,
    ];
  }, [preview, handleAddFromFile, widgetableId, uploadStatus, uploadError]);

  return <ImagePreviewSplitList items={items} />;
};
