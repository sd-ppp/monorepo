import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    layout: 'fullscreen',
    backgrounds: {
      disable: true
    },
    a11y: {
      // keep violations in the panel until the host decides to fail CI
      manual: true
    }
  },
  decorators: [
    (Story) => (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--sb-app-background, #f6f7f9)',
          color: 'var(--sb-app-foreground, inherit)'
        }}
        data-sdppp-storybook-root
      >
        <Story />
      </div>
    )
  ]
};

export default preview;
