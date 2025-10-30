import type { Meta, StoryObj } from '@storybook/react';
import { useState, useCallback } from 'react';
import { ImageSyncGroup } from '@sdppp/ui-library';
import type { ButtonConfig } from '@sdppp/ui-library';

const meta: Meta<typeof ImageSyncGroup> = {
  title: 'Components/ImageSyncGroup',
  component: ImageSyncGroup,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ImageSyncGroup>;

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

const buttons: ButtonConfig[] = [
  { id: 'red', text: 'Sync Red', supportsAutoSync: true },
  { id: 'blue', text: 'Sync Blue', supportsAutoSync: true },
  { id: 'green', text: 'Sync Green', supportsAutoSync: true },
];

export const Default: Story = {
  render: () => {
    const [imageUrl, setImageUrl] = useState(
      generateSvgBase64(getRandomColor('grey')!, 'initial')
    );

    const handleSync = useCallback(async (id: string) => {
      const color = getRandomColor(id as 'red' | 'green' | 'blue' | 'grey');
      const newUrl = generateSvgBase64(color!, id);
      await new Promise(resolve => setTimeout(resolve, 100));
      setImageUrl(newUrl);
    }, []);

    return (
      <ImageSyncGroup
        imageUrl={imageUrl}
        buttons={buttons}
        onSync={async (id) => handleSync(id)}
        onAutoSyncChange={() => {}}
        buttonWidth={140}
      />
    );
  },
};
