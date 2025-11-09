import { useWidgetText } from '../context/WidgetImageMaskContext';
import { ImagePreviewSplitList, SyncButton } from '@sdppp/ui-library';
import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { UploadableImagePreviewSplit } from './shared/UploadableImagePreviewSplit';

interface MaskSelectorProps {
  widgetableId: string;
  value: string[];
  onValueChange?: (value: string[]) => void;
}

export const MaskSelector: React.FC<MaskSelectorProps> = ({ widgetableId, value = [], onValueChange }) => {
  const t = useWidgetText();
  // Stateless render; provider supplies APIs via context when needed
  void onValueChange;

  const items = useMemo(() => {
    const imageUrl = value?.[0] ?? '';
    const leftNode = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              {t('image.upload.mask.selection', { defaultValue: '选区遮罩' })}
            </span>
          </SyncButton>
        </div>
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
              {t('image.upload.mask.layer', { defaultValue: '图层遮罩' })}
            </span>
          </SyncButton>
        </div>
        <div>
          <SyncButton
            buttonSize={160}
            disabled={true}
            isAutoSync={false}
            autoSyncEnabled={false}
            onSync={() => {}}
            onAutoSyncToggle={() => {}}
          >
            {t('image.upload.primary.advanced.reset', { defaultValue: '重置' })}
          </SyncButton>
        </div>
      </div>
    );

    return [
      <UploadableImagePreviewSplit
        key={`mask-selector-${widgetableId}`}
        left={leftNode}
        imageUrl={imageUrl}
        background="white"
      />,
    ];
  }, [value, t, widgetableId]);

  return <ImagePreviewSplitList items={items} />;
};
