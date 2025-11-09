import { useWidgetImageMaskActions, useWidgetText } from '../context/WidgetImageMaskContext';
import { ImagePreviewSplitList, SyncButton } from '@sdppp/ui-library';
import { Button } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { UploadableImagePreviewSplit } from './common/UploadableImagePreviewSplit';

interface MultiImageSelectorProps {
  widgetableId: string;
  value: string[];
  maxCount: number;
  onValueChange?: (value: string[]) => void;
}

const ADVANCED_HINT_TRANSLATIONS = [
  { key: 'image.upload.primary.hint.line1', defaultValue: '本节点默认使用' },
  { key: 'image.upload.primary.hint.line2', defaultValue: '当前图层+遮罩' },
];

export const MultiImageSelector: React.FC<MultiImageSelectorProps> = ({
  widgetableId,
  value = [],
  maxCount,
  onValueChange,
}) => {
  const t = useWidgetText();
  const actions = useWidgetImageMaskActions();
  const emitValue = useCallback(
    (next: string[]) => {
      if (!onValueChange) return;
      onValueChange(next);
    },
    [onValueChange],
  );

  const limit = Math.max(1, maxCount || 1);
  const initialCount = Math.min(limit, Math.max(1, Array.isArray(value) ? value.length : 0));
  const [previews, setPreviews] = useState<string[]>(() => {
    const arr = Array.from({ length: initialCount }, (_, i) => value?.[i] ?? '');
    return arr;
  });

  useEffect(() => {
    const count = Math.min(limit, Math.max(1, Array.isArray(value) ? value.length : 0));
    setPreviews(prev => {
      const next = Array.from({ length: count }, (_, i) => value?.[i] ?? prev[i] ?? '');
      return next;
    });
  }, [value, limit]);

  const [uploadingCounts, setUploadingCounts] = useState<Record<number, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<number, string>>({});
  const [uploadProgressByIndex, setUploadProgressByIndex] = useState<
    Record<number, { current: number; total: number }>
  >({});

  const setErrorForIndex = useCallback((index: number, message: string | null) => {
    setUploadErrors(prev => {
      if (!message) {
        if (!(index in prev)) return prev;
        const { [index]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [index]: message,
      };
    });
  }, []);

  const markUploadingStart = useCallback((index: number) => {
    setUploadingCounts(prev => ({
      ...prev,
      [index]: (prev[index] ?? 0) + 1,
    }));
  }, []);

  const markUploadingEnd = useCallback((index: number) => {
    setUploadingCounts(prev => {
      const current = prev[index] ?? 0;
      if (current <= 1) {
        const { [index]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [index]: current - 1,
      };
    });
  }, []);

  const slots = useMemo(() => {
    return Array.from({ length: previews.length }, (_, i) => i);
  }, [previews.length]);

  const advancedHintLines = ADVANCED_HINT_TRANSLATIONS.map(({ key, defaultValue }) =>
    t(key, { defaultValue })
  );

  const handleAddFromFile = useCallback(
    async (index: number) => {
      markUploadingStart(index);
      setUploadProgressByIndex(prev => ({
        ...prev,
        [index]: { current: 0, total: 1 },
      }));
      setErrorForIndex(index, null);
      let encounteredError = false;
      try {
        const createResult = await actions['resource.file.createFromLocal']();
        if (!createResult || createResult.error) {
          encounteredError = true;
          const message =
            (typeof createResult?.error === 'string' && createResult.error.trim().length
              ? createResult.error.trim()
              : t('image.upload.error', { defaultValue: '上传失败，请重试' }));
          setErrorForIndex(index, message);
          return;
        }
        const resource = createResult.resource;
        if (!resource) {
          encounteredError = true;
          setErrorForIndex(index, t('image.upload.error', { defaultValue: '上传失败，请重试' }));
          return;
        }
        const inlineThumb = createResult.thumbnail;
        const previewSource =
          inlineThumb ??
          ((await actions['resource.thumbnail']({ resource }))?.thumbnail ?? null);

        setPreviews(curr => {
          const next = curr.slice();
          while (next.length <= index) next.push('');
          next[index] = previewSource ?? resource;
          return next;
        });

        const base = Array.isArray(value) ? value.slice() : [];
        while (base.length <= index) base.push('');
        base[index] = resource;
        emitValue(base);
        setErrorForIndex(index, null);
        setUploadProgressByIndex(prev => ({
          ...prev,
          [index]: { current: 1, total: prev[index]?.total ?? 1 },
        }));
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : t('image.upload.error', { defaultValue: '上传失败，请重试' });
        setErrorForIndex(index, message);
        encounteredError = true;
      } finally {
        markUploadingEnd(index);
        if (!encounteredError) {
          setUploadProgressByIndex(prev => {
            if (!(index in prev)) return prev;
            const { [index]: _removed, ...rest } = prev;
            return rest;
          });
        }
      }
    },
    [
      actions,
      emitValue,
      value,
      markUploadingStart,
      markUploadingEnd,
      setErrorForIndex,
      t,
      setUploadProgressByIndex,
    ],
  );

  const items = useMemo(() => {
    return slots.map(index => {
      const imageUrl = previews?.[index] ?? '';
      const isUploading = (uploadingCounts[index] ?? 0) > 0;
       const errorMessage = uploadErrors[index];
       const uploadStatus = errorMessage ? 'error' : isUploading ? 'uploading' : 'idle';
      const progress = uploadProgressByIndex[index];
      const leftNode = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Advanced hint + modify (fixed total width 160) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: 160 }}>
            <div style={{ width: 96, fontSize: 12, lineHeight: 1.2, paddingRight: 4 }}>
              {advancedHintLines.map((line, idx) => (
                <React.Fragment key={idx}>
                  {line}
                  {idx < advancedHintLines.length - 1 ? <br /> : null}
                </React.Fragment>
              ))}
            </div>
            <SyncButton
              className="modify-no-padding"
              buttonSize={64}
              disabled={true}
              isAutoSync={false}
              autoSyncEnabled={false}
              onSync={() => {}}
              onAutoSyncToggle={() => {}}
            >
              {t('image.upload.primary.advanced.modify', { defaultValue: '修改' })}
            </SyncButton>
          </div>
          {/* Primary button with auto */}
          <div>
            <SyncButton
              buttonSize={160}
              disabled={false}
              isAutoSync={false}
              onSync={() => {
                void handleAddFromFile(index);
              }}
              onAutoSyncToggle={() => {}}
              autoSyncEnabled={false}
              descText={undefined}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Plus size={16} strokeWidth={2} />
                {t('image.upload.primary.manual', { defaultValue: '使用主图' })}
              </span>
            </SyncButton>
          </div>
          <div style={{ height: 1, background: 'var(--ant-color-border,#d9d9d9)' }} />
          {/* Mask button */}
          <div>
            <SyncButton
              buttonSize={160}
              disabled={true}
              isAutoSync={false}
              autoSyncEnabled={true}
              onSync={() => {}}
              onAutoSyncToggle={() => {}}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Plus size={16} strokeWidth={2} />
                {t('image.upload.mask.button', { defaultValue: '选区遮罩' })}
              </span>
            </SyncButton>
          </div>
        </div>
      );

      return (
        <UploadableImagePreviewSplit
          key={`multi-image-${widgetableId}-${index}`}
          left={leftNode}
          imageUrl={imageUrl}
          background="checkerboard"
          indicatorPlacement="below"
          uploadStatus={uploadStatus}
          uploadIndicatorErrorMessage={errorMessage}
          uploadIndicatorProgressCurrent={progress?.current}
          uploadIndicatorProgressTotal={progress?.total}
          onUploadDismiss={
            errorMessage
              ? () => {
                  setErrorForIndex(index, null);
                  setUploadProgressByIndex(prev => {
                    if (!(index in prev)) return prev;
                    const { [index]: _removed, ...rest } = prev;
                    return rest;
                  });
                }
              : undefined
          }
        />
      );
    });
  }, [
    slots,
    previews,
    t,
    advancedHintLines,
    handleAddFromFile,
    widgetableId,
    uploadingCounts,
    uploadErrors,
    setErrorForIndex,
    uploadProgressByIndex,
    setUploadProgressByIndex,
  ]);

  const showAddRemove = limit !== 1;

  return (
    <div>
      <ImagePreviewSplitList items={items} />
      {showAddRemove ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Button type="dashed" icon={<Plus size={16} strokeWidth={2} />} disabled>
            {t('image.upload.add_slot', { defaultValue: '新增槽位' })}
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            {slots.map(index => (
              <Button key={`remove-${index}`} size="small" type="default" disabled>
                {index}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
