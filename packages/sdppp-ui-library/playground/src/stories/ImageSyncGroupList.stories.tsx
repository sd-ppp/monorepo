import type { Meta, StoryObj } from '@storybook/react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { ImageSyncGroupList } from '@sdppp/ui-library';
import type { ImageSyncGroupData, ButtonConfig } from '@sdppp/ui-library';

const meta: Meta<typeof ImageSyncGroupList> = {
  title: 'Components/ImageSyncGroupList',
  component: ImageSyncGroupList,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ImageSyncGroupList>;

const getRandomHex = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1) + min)
    .toString(16)
    .padStart(2, '0');

const getRandomColor = (hue: 'red' | 'green' | 'blue' | 'grey') => {
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

const createNewGroup = (label: string): ImageSyncGroupData => ({
  imageUrl: generateSvgBase64(getRandomColor('grey')!, label),
  buttons: baseButtons.map(button => ({ ...button })),
});

const initialGroups: ImageSyncGroupData[] = [createNewGroup('Initial')];

export const Default: Story = {
  name: 'Dynamic Image Color on Sync',
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

    const handleSync = useCallback(async (index: number, id: string) => {
      const color = getRandomColor(id as 'red' | 'green' | 'blue' | 'grey');
      const newUrl = generateSvgBase64(color!, id);
      await new Promise(resolve => setTimeout(resolve, 100));
      setGroups(prev =>
        prev.map((group, i) => (i === index ? { ...group, imageUrl: newUrl } : group))
      );
    }, []);

    const handleAutoSyncChange = useCallback((index: number, activeId: string | null) => {
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
    }, [handleSync]);

    useEffect(() => {
      const cleanup = () => {
        Object.values(timersRef.current).forEach(timer => clearInterval(timer));
        timersRef.current = {};
      };
      return cleanup;
    }, []);

    return (
      <ImageSyncGroupList
        groups={groups}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onSync={handleSync}
        onAutoSyncChange={handleAutoSyncChange}
        buttonWidth={140}
      />
    );
  },
};

export const ReadOnly: Story = {
  name: 'Read-Only List',
  args: {
    groups: [createNewGroup('Group 0'), createNewGroup('Group 1')],
    showAddRemove: false,
  },
  render: (args) => {
    const [groups, setGroups] = useState(args.groups!);

    const handleSync = useCallback(async (index: number, id: string) => {
      const color = getRandomColor(id as 'red' | 'green' | 'blue' | 'grey');
      const newUrl = generateSvgBase64(color!, id);
      await new Promise(resolve => setTimeout(resolve, 100));
      setGroups(prev =>
        prev.map((group, i) => (i === index ? { ...group, imageUrl: newUrl } : group))
      );
    }, []);

    return (
      <ImageSyncGroupList
        {...args}
        groups={groups}
        onSync={handleSync}
        onAdd={() => {}}
        onRemove={() => {}}
        onAutoSyncChange={() => {}}
        buttonWidth={140}
      />
    );
  },
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

    const getRandomHex = (min: number, max: number) =>
      Math.floor(Math.random() * (max - min + 1) + min)
        .toString(16)
        .padStart(2, '0');

    const getRandomColor = (
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
          // red + green
          return `${high}${mid}${low}`;
        case 'purple':
          // red + blue
          return `${high}${low}${mid}`;
        case 'cyan':
          // green + blue
          return `${low}${high}${mid}`;
      }
    };

    const generateSvgBase64 = (color: string, text: string) => {
      const capitalizedText = text.charAt(0).toUpperCase() + text.slice(1);
      const svg = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"200\" viewBox=\"0 0 200 200\">\n    <rect width=\"100%\" height=\"100%\" fill=\"#${color}\"/>\n    <text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" font-family=\"sans-serif\" font-size=\"20px\" fill=\"#FFFFFF\">${capitalizedText}</text>\n  </svg>`;
      const base64 = btoa(svg);
      return `data:image/svg+xml;base64,${base64}`;
    };

    const handleSync = useCallback(async (index: number, id: string, event: { shiftKey: boolean }) => {
      // With Shift: use alternate palette
      const hueMap: Record<string, 'red' | 'green' | 'blue' | 'orange' | 'purple' | 'cyan' | 'grey'> = {
        red: event.shiftKey ? 'orange' : 'red',
        blue: event.shiftKey ? 'purple' : 'blue',
        green: event.shiftKey ? 'cyan' : 'green',
      };
      const hue = hueMap[id] ?? 'grey';
      const color = getRandomColor(hue);
      const newUrl = generateSvgBase64(color!, id + (event.shiftKey ? ' (shift)' : ''));
      await new Promise(resolve => setTimeout(resolve, 100));
      setGroups(prev => prev.map((g, i) => (i === index ? { ...g, imageUrl: newUrl } : g)));
    }, []);

    const handleAutoSyncChange = useCallback((index: number, activeId: string | null) => {
      const timers = timersRef.current;
      const currentTimer = timers[index];
      if (currentTimer) {
        clearInterval(currentTimer);
        delete timers[index];
      }
      if (activeId) {
        void handleSync(index, activeId, { shiftKey: false });
        timers[index] = setInterval(() => {
          void handleSync(index, activeId, { shiftKey: false });
        }, 1500);
      }
    }, [handleSync]);

    return (
      <ImageSyncGroupList
        groups={groups}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onSync={handleSync}
        onAutoSyncChange={handleAutoSyncChange}
        buttonWidth={140}
      />
    );
  },
};
