import type { Meta, StoryObj } from '@storybook/react';
import { ImagePreviewFrame } from '@sdppp/ui-library';

const generateSvgBase64 = (color: string, text: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24px" fill="#ffffff">${text}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const meta: Meta<typeof ImagePreviewFrame> = {
  title: 'Components/ImagePreviewFrame',
  component: ImagePreviewFrame,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    imageUrl: generateSvgBase64('#4a90e2', 'Preview'),
  },
};

export default meta;
type Story = StoryObj<typeof ImagePreviewFrame>;

const renderWithinContainer: Story['render'] = args => (
  <div
    style={{
      position: 'relative',
      width: 320,
      height: 200,
    }}
  >
    <ImagePreviewFrame {...args} />
  </div>
);

export const Checkerboard: Story = {
  render: renderWithinContainer,
};

export const WhiteBackground: Story = {
  render: renderWithinContainer,
  args: {
    background: 'white',
  },
};

export const CustomInnerFrame: Story = {
  render: renderWithinContainer,
  args: {
    previewStyle: {
      borderRadius: 12,
      boxShadow: 'inset 0 0 0 3px rgba(255, 255, 255, 0.4)',
    },
  },
};

export const LocalTransparentPortrait: Story = {
  render: renderWithinContainer,
  args: {
    imageUrl: '/images/transparent-portrait.png',
  },
};
