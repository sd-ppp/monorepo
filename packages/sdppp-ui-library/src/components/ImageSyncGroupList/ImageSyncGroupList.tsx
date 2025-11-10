import { type FC, useState } from 'react';
import { Button } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import { ImageSyncGroup } from '../ImageSyncGroup/ImageSyncGroup';
import type { ButtonConfig } from '../ExclusiveSyncGroup/ExclusiveSyncGroup';

export interface ImageSyncGroupData {
  buttons: ButtonConfig[];
  imageUrl: string;
  activeAutoSyncId?: string | null;
  uploading?: boolean;
}

export interface ImageSyncGroupListProps {
  groups: ImageSyncGroupData[];
  onSync: (index: number, id: string, event: { altKey: boolean; shiftKey: boolean }) => Promise<void>;
  onAutoSyncChange: (index: number, activeId: string | null, event: { altKey: boolean; shiftKey: boolean }) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  showAddRemove?: boolean;
  buttonSize?: number | string;
  // visual options
  background?: 'checkerboard' | 'white';
}

export const ImageSyncGroupList: FC<ImageSyncGroupListProps> = ({
  groups,
  onSync,
  onAutoSyncChange,
  onAdd,
  onRemove,
  showAddRemove = true,
  buttonSize,
  background = 'checkerboard',
}) => {
  const [hoveredRemoveIndex, setHoveredRemoveIndex] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {groups.map((group, index) => (
        <div key={index} style={{ width: '100%' }}>
          <ImageSyncGroup
            {...group}
            buttonSize={buttonSize}
            data-testid={`image-sync-group-${index}`}
            onSync={(id, event) => onSync(index, id, event)}
            onAutoSyncChange={(activeId, event) => onAutoSyncChange(index, activeId, event)}
            background={background}
          />
        </div>
      ))}

      {showAddRemove && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <Button
            type="dashed"
            onClick={onAdd}
            icon={<Plus size={16} />}
            style={{ width: 120, justifyContent: 'center' }}
          >
            Add
          </Button>
          {groups.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {groups.map((_, index) => {
                const isHovered = hoveredRemoveIndex === index;

                return (
                  <Button
                    key={`remove-${index}`}
                    size="small"
                    type="default"
                    icon={isHovered ? <Trash2 size={14} /> : undefined}
                    onMouseEnter={() => setHoveredRemoveIndex(index)}
                    onMouseLeave={() => setHoveredRemoveIndex(prev => (prev === index ? null : prev))}
                    onClick={() => onRemove(index)}
                    aria-label={`Remove group ${index}`}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    {isHovered ? null : index}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
