import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  ExclusiveSyncGroup,
  type ButtonConfig,
  ImagePreviewSplitList,
} from '@sdppp/ui-library';

const getRandomHex = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1) + min)
    .toString(16)
    .padStart(2, '0');

const baseGetRandomColor = (hue: 'red' | 'green' | 'blue' | 'grey') => {
  if (hue === 'grey') return 'cccccc';
  const high = getRandomHex(150, 255);
  const low1 = getRandomHex(50, 120);
  const low2 = getRandomHex(50, 120);
  switch (hue) {
    case 'red':
      return `${high}${low1}${low2}`;
    case 'green':
      return `${low1}${high}${low2}`;
    case 'blue':
      return `${low1}${low2}${high}`;
  }
};

const generateSvgBase64 = (color: string, text: string) => {
  const capitalizedText = text.charAt(0).toUpperCase() + text.slice(1);
  const svg = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"200\" viewBox=\"0 0 200 200\">\n    <rect width=\"100%\" height=\"100%\" fill=\"#${color}\"/>\n    <text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" font-family=\"sans-serif\" font-size=\"20px\" fill=\"#FFFFFF\">${capitalizedText}</text>\n  </svg>`;
  const base64 = btoa(svg);
  return `data:image/svg+xml;base64,${base64}`;
};

const baseButtons: ButtonConfig[] = [
  { id: 'red', text: 'Sync Red', supportsAutoSync: true },
  { id: 'blue', text: 'Sync Blue', supportsAutoSync: true },
  { id: 'green', text: 'Sync Green', supportsAutoSync: true },
];

interface GroupState {
  imageUrl: string;
  buttons: ButtonConfig[];
  activeAutoSyncId?: string | null;
}

const createNewGroup = (label: string): GroupState => ({
  imageUrl: generateSvgBase64(baseGetRandomColor('grey')!, label),
  buttons: baseButtons.map(button => ({ ...button })),
  activeAutoSyncId: null,
});

const initialGroups: GroupState[] = [createNewGroup('Initial')];

type ModifierEvent = { altKey: boolean; shiftKey: boolean };

const meta: Meta<typeof ImagePreviewSplitList> = {
  title: 'Components/ImagePreviewSplitList',
  component: ImagePreviewSplitList,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ImagePreviewSplitList>;

export const Default: Story = {
  name: 'Dynamic Image Color on Sync',
  render: () => {
    const [groups, setGroups] = useState(initialGroups);
    const [hoveredRemoveIndex, setHoveredRemoveIndex] = useState<number | null>(null);
    const timersRef = useRef<Record<number, ReturnType<typeof setInterval>>>({});

    const handleAdd = useCallback(() => {
      setGroups(prev => [...prev, createNewGroup(`Group ${prev.length}`)]);
    }, []);

    const handleRemove = useCallback((index: number) => {
      setGroups(prev => prev.filter((_, i) => i !== index));

      const timers = timersRef.current;
      if (timers[index]) {
        clearInterval(timers[index]!);
        delete timers[index];
      }

      const nextTimers: Record<number, ReturnType<typeof setInterval>> = {};
      Object.entries(timers).forEach(([key, value]) => {
        const timerIndex = Number(key);
        if (timerIndex > index) {
          nextTimers[timerIndex - 1] = value;
        } else if (timerIndex < index) {
          nextTimers[timerIndex] = value;
        }
      });
      timersRef.current = nextTimers;
    }, []);

    const handleSync = useCallback(
      async (index: number, id: string) => {
        const color = baseGetRandomColor(id as 'red' | 'green' | 'blue' | 'grey');
        const newUrl = generateSvgBase64(color!, id);
        await new Promise(resolve => setTimeout(resolve, 100));
        setGroups(prev =>
          prev.map((group, i) => (i === index ? { ...group, imageUrl: newUrl } : group))
        );
      },
      []
    );

    const handleAutoSyncChange = useCallback(
      (index: number, activeId: string | null) => {
        setGroups(prev =>
          prev.map((group, i) =>
            i === index ? { ...group, activeAutoSyncId: activeId } : group
          )
        );

        const timers = timersRef.current;
        const currentTimer = timers[index];
        if (currentTimer) {
          clearInterval(currentTimer);
          delete timers[index];
        }

        if (activeId) {
          void handleSync(index, activeId);
          timers[index] = setInterval(() => {
            void handleSync(index, activeId);
          }, 1500);
        }
      },
      [handleSync]
    );

    useEffect(() => {
      return () => {
        Object.values(timersRef.current).forEach(timer => clearInterval(timer));
        timersRef.current = {};
      };
    }, []);

    const items = useMemo(
      () =>
        groups.map((group, index) => ({
          id: index,
          imageUrl: group.imageUrl,
          background: 'checkerboard' as const,
          left: (
            <ExclusiveSyncGroup
              buttons={group.buttons}
              onSync={(id, _event) => handleSync(index, id)}
              onAutoSyncChange={(activeId, _event) =>
                handleAutoSyncChange(index, activeId)
              }
              activeAutoSyncId={group.activeAutoSyncId ?? null}
              buttonSize={140}
            />
          ),
        })),
      [groups, handleAutoSyncChange, handleSync]
    );

    return (
      <Space direction="vertical" size={12}>
        <ImagePreviewSplitList items={items} />

        <Space align="center" size={8}>
          <Button
            type="dashed"
            onClick={handleAdd}
            icon={<PlusOutlined />}
            style={{ width: 120, justifyContent: 'center' }}
          >
            Add
          </Button>
          {groups.length > 1 && (
            <Space size={4} wrap>
              {groups.map((_, index) => {
                const isHovered = hoveredRemoveIndex === index;
                return (
                  <Button
                    key={`remove-${index}`}
                    size="small"
                    type="default"
                    icon={isHovered ? <DeleteOutlined /> : undefined}
                    onMouseEnter={() => setHoveredRemoveIndex(index)}
                    onMouseLeave={() =>
                      setHoveredRemoveIndex(prev => (prev === index ? null : prev))
                    }
                    onClick={() => handleRemove(index)}
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
            </Space>
          )}
        </Space>
      </Space>
    );
  },
};

export const ReadOnly: Story = {
  name: 'Read-Only List',
  args: {
    showControls: false,
  },
  render: () => {
    const [groups, setGroups] = useState(() => [
      createNewGroup('Group 0'),
      createNewGroup('Group 1'),
    ]);

    const handleSync = useCallback(async (index: number, id: string) => {
      const color = baseGetRandomColor(id as 'red' | 'green' | 'blue' | 'grey');
      const newUrl = generateSvgBase64(color!, id);
      await new Promise(resolve => setTimeout(resolve, 100));
      setGroups(prev =>
        prev.map((group, i) => (i === index ? { ...group, imageUrl: newUrl } : group))
      );
    }, []);

    const items = useMemo(
      () =>
        groups.map((group, index) => ({
          id: index,
          imageUrl: group.imageUrl,
          background: 'checkerboard' as const,
          left: (
            <ExclusiveSyncGroup
              buttons={group.buttons}
              onSync={(id, _event) => handleSync(index, id)}
              onAutoSyncChange={(_activeId, _event) => {}}
              activeAutoSyncId={null}
              buttonSize={140}
            />
          ),
        })),
      [groups, handleSync]
    );

    return <ImagePreviewSplitList items={items} />;
  },
};

const extendedGetRandomColor = (
  hue: 'red' | 'green' | 'blue' | 'grey' | 'orange' | 'purple' | 'cyan'
) => {
  if (hue === 'grey') return 'cccccc';
  const high = getRandomHex(150, 255);
  const mid = getRandomHex(120, 200);
  const low = getRandomHex(50, 120);
  switch (hue) {
    case 'red':
      return `${high}${low}${low}`;
    case 'green':
      return `${low}${high}${low}`;
    case 'blue':
      return `${low}${low}${high}`;
    case 'orange':
      return `${high}${mid}${low}`;
    case 'purple':
      return `${high}${low}${mid}`;
    case 'cyan':
      return `${low}${high}${mid}`;
  }
};

export const ShiftModifierColors: Story = {
  name: 'Shift-Key Alternate Colors',
  render: () => {
    const [groups, setGroups] = useState(initialGroups);
    const timersRef = useRef<Record<number, ReturnType<typeof setInterval>>>({});

    const handleAdd = useCallback(() => {
      setGroups(prev => [...prev, createNewGroup(`Group ${prev.length}`)]);
    }, []);

    const handleRemove = useCallback((index: number) => {
      setGroups(prev => prev.filter((_, i) => i !== index));
      const timers = timersRef.current;
      if (timers[index]) {
        clearInterval(timers[index]!);
        delete timers[index];
      }
    }, []);

    const handleSync = useCallback(
      async (index: number, id: string, event: ModifierEvent) => {
        const hueMap: Record<string, 'red' | 'green' | 'blue' | 'orange' | 'purple' | 'cyan' | 'grey'> =
          {
            red: event.shiftKey ? 'orange' : 'red',
            blue: event.shiftKey ? 'purple' : 'blue',
            green: event.shiftKey ? 'cyan' : 'green',
          };
        const hue = hueMap[id] ?? 'grey';
        const color = extendedGetRandomColor(hue);
        const newUrl = generateSvgBase64(color!, id + (event.shiftKey ? ' (shift)' : ''));
        await new Promise(resolve => setTimeout(resolve, 100));
        setGroups(prev =>
          prev.map((group, i) => (i === index ? { ...group, imageUrl: newUrl } : group))
        );
      },
      []
    );

    const handleAutoSyncChange = useCallback(
      (index: number, activeId: string | null) => {
        setGroups(prev =>
          prev.map((group, i) =>
            i === index ? { ...group, activeAutoSyncId: activeId } : group
          )
        );

        const timers = timersRef.current;
        const currentTimer = timers[index];
        if (currentTimer) {
          clearInterval(currentTimer);
          delete timers[index];
        }

        if (activeId) {
          void handleSync(index, activeId, { altKey: false, shiftKey: false });
          timers[index] = setInterval(() => {
            void handleSync(index, activeId, { altKey: false, shiftKey: false });
          }, 1500);
        }
      },
      [handleSync]
    );

    useEffect(() => {
      return () => {
        Object.values(timersRef.current).forEach(timer => clearInterval(timer));
        timersRef.current = {};
      };
    }, []);

    const items = useMemo(
      () =>
        groups.map((group, index) => ({
          id: index,
          imageUrl: group.imageUrl,
          background: 'checkerboard' as const,
          left: (
            <ExclusiveSyncGroup
              buttons={group.buttons}
              onSync={(id, event) => handleSync(index, id, event)}
              onAutoSyncChange={(activeId, event) => handleAutoSyncChange(index, activeId, event)}
              activeAutoSyncId={group.activeAutoSyncId ?? null}
              buttonSize={140}
            />
          ),
        })),
      [groups, handleAutoSyncChange, handleSync]
    );

    return (
      <Space direction="vertical" size={12}>
        <ImagePreviewSplitList items={items} />
        <Space>
          <Button
            type="dashed"
            onClick={handleAdd}
            icon={<PlusOutlined />}
            style={{ width: 120, justifyContent: 'center' }}
          >
            Add
          </Button>
          {groups.length > 1 && (
            <Button onClick={() => handleRemove(groups.length - 1)}>Remove Last</Button>
          )}
        </Space>
      </Space>
    );
  },
};
