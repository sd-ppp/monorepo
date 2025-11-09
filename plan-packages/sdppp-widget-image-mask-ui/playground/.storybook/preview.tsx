import type { Preview } from '@storybook/react-vite';
import { useArgs } from '@storybook/preview-api';
import 'antd/dist/reset.css';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MockExternalApiProvider } from '../src/mock-external-api';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: 'todo' },
  },
  decorators: [
    (Story) => {
      const [args, updateArgs] = useArgs();
      const rawValue = args?.value;
      const imageUrls = React.useMemo(() => {
        if (!Array.isArray(rawValue)) return undefined;
        return rawValue.map(item => (typeof item === 'string' ? item : item != null ? String(item) : ''));
      }, [rawValue]);

      const handleImageUrlsChange = React.useCallback(
        (next: string[]) => {
          if (!Array.isArray(rawValue)) return;
          const sanitized = next.map(item => (typeof item === 'string' ? item : item != null ? String(item) : ''));
          const current = imageUrls ?? [];
          const isSame =
            current.length === sanitized.length &&
            current.every((entry, index) => entry === sanitized[index]);
          if (isSame) return;
          updateArgs({ value: sanitized });
        },
        [rawValue, imageUrls, updateArgs],
      );

      // Minimal i18n setup for stories
      if (!i18n.isInitialized) {
        i18n.use(initReactI18next).init({
          resources: {
            'zh-CN': { translation: {} },
            'en-US': { translation: {} },
          },
          lng: 'zh-CN',
          fallbackLng: 'en-US',
          interpolation: { escapeValue: false },
        });
      }

      return (
        <I18nextProvider i18n={i18n}>
          <MockExternalApiProvider
            t={(key, options) => options?.defaultValue ?? key}
            logger={(...args) => console.log('[WidgetImageMask]', ...args)}
            imageUrls={imageUrls}
            onImageUrlsChange={Array.isArray(rawValue) ? handleImageUrlsChange : undefined}
          >
            <Story />
          </MockExternalApiProvider>
        </I18nextProvider>
      );
    },
  ],
};

export default preview;
