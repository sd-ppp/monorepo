import React from 'react';
import { Button, Tooltip } from 'antd';
import { Plus, Minus } from 'lucide-react';
import { useWidgetText } from '../../context/SdpppWidgetContext';

export interface MultiSlotActionsProps {
  /** 是否可以添加 slot */
  canAdd: boolean;
  /** 是否可以删除 slot */
  canRemove: boolean;
  /** 添加 slot 回调 */
  onAdd: () => void;
  /** 删除最后一个 slot 回调 */
  onRemove: () => void;
}

/**
 * 多 slot 操作按钮组件
 * 
 * @remarks
 * 提供添加和删除 slot 的按钮
 * 
 * @example
 * ```tsx
 * <MultiSlotActions
 *   canAdd={slots.length < maxCount}
 *   canRemove={slots.length > 1}
 *   onAdd={handleAddSlot}
 *   onRemove={handleRemoveLastSlot}
 * />
 * ```
 */
export const MultiSlotActions: React.FC<MultiSlotActionsProps> = ({
  canAdd,
  canRemove,
  onAdd,
  onRemove,
}) => {
  const t = useWidgetText();

  const addLabel = t('image.upload.add_slot', { defaultValue: '增加图片' });
  const removeLabel = t('image.upload.remove_slot', { defaultValue: '移除图片' });
  const removeTooltip = t('image.upload.remove_last_slot.tooltip', {
    defaultValue: '移除最后一个图片',
  });

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        gap: 8,
      }}
    >
      <Button
        type="dashed"
        icon={<Plus size={16} strokeWidth={2} />}
        disabled={!canAdd}
        onClick={onAdd}
        aria-label={addLabel}
        style={{
          flex: 1,
          height: 40,
        }}
      >
        {addLabel}
      </Button>
      <Tooltip title={removeTooltip}>
        <div style={{ flex: 1, height: 40 }}>
          <Button
            type="default"
            icon={<Minus size={16} strokeWidth={2} />}
            disabled={!canRemove}
            onClick={onRemove}
            aria-label={removeLabel}
            style={{
              width: '100%',
              height: '100%',
            }}
          >
            {removeLabel}
          </Button>
        </div>
      </Tooltip>
    </div>
  );
};

MultiSlotActions.displayName = 'MultiSlotActions';
