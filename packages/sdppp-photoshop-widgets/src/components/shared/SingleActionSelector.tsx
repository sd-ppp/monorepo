import { ImagePreviewSplitList } from '@sdppp/ui-library';
import { Button } from 'antd';
import React, { useMemo } from 'react';
import { useWidgetText } from '../../context/PhotoshopWidgetContext';
import { Plus } from 'lucide-react';

interface SingleActionSelectorProps {
  widgetableId: string;
  value: string[];
  buttonLabel: string;
}

export const SingleActionSelector: React.FC<SingleActionSelectorProps> = ({
  widgetableId,
  value = [],
  buttonLabel,
}) => {
  const t = useWidgetText();

  const items = useMemo(() => {
    const imageUrl = value?.[0] ?? '';
    const leftNode = (
      <div style={{ display: 'flex', flexDirection: 'column', width: 160 }}>
        <Button
          type="dashed"
          block
          style={{ height: 100, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          icon={<Plus size={16} strokeWidth={2} />}
        >
          {buttonLabel}
        </Button>
      </div>
    );

    return [
      {
        left: leftNode,
        imageUrl,
        background: 'checkerboard' as const,
      },
    ];
  }, [value, buttonLabel, t]);

  return <ImagePreviewSplitList items={items} />;
};
