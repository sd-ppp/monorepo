import type { Preview } from '@storybook/react-vite';
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
    (Story, context) => {
      const { args, updateArgs } = context;
      const normalizedInitial = React.useMemo(() => {
        const raw = args?.value;
        if (!Array.isArray(raw)) return [];
        return raw.map(item => (typeof item === 'string' ? item : item != null ? String(item) : ''));
      }, [args?.value]);

      const [imageUrls, setImageUrls] = React.useState<string[]>(normalizedInitial);

      React.useEffect(() => {
        setImageUrls(prev => {
          if (
            prev.length === normalizedInitial.length &&
            prev.every((entry, index) => entry === normalizedInitial[index])
          ) {
            return prev;
          }
          return normalizedInitial;
        });
      }, [normalizedInitial]);

      const pushArgs = React.useCallback(
        (next: string[]) => {
          if (typeof updateArgs === 'function') {
            updateArgs({ value: next });
          }
        },
        [updateArgs],
      );

      const handleStoryValueChange = React.useCallback(
        (next: string[]) => {
          console.log('[Preview] story onValueChange', next);
          setImageUrls(next);
          pushArgs(next);
        },
        [pushArgs],
      );

      const handleImageUrlsChange = React.useCallback(
        (next: string[]) => {
          console.log('[Preview] provider imageUrls change', next);
          setImageUrls(prev => {
            if (prev.length === next.length && prev.every((entry, index) => entry === next[index])) {
              return prev;
            }
            return next;
          });
          pushArgs(next);
        },
        [pushArgs],
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
            onImageUrlsChange={handleImageUrlsChange}
            panelWidth={320}
          >
            <Story args={{ ...args, value: imageUrls, onValueChange: handleStoryValueChange }} />
          </MockExternalApiProvider>
        </I18nextProvider>
      );
    },
  ],
};

export default preview;
