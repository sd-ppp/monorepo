import type { StorybookConfig } from '@storybook/react-vite';
import path from 'node:path';

const config: StorybookConfig = {
  stories: [
    '../src/stories/**/*.mdx',
    '../src/stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'
  ],
  staticDirs: ['../public'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest'
  ],
  typescript: {
    reactDocgen: 'react-docgen-typescript'
  },
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  viteFinal: async (viteConfig) => {
    // Alias the library package name to the root TS entry for dev
    viteConfig.resolve ??= {} as any;
    const addAlias = (find: string, replacement: string) => {
      const current = (viteConfig.resolve as any).alias;
      if (Array.isArray(current)) {
        const exists = current.find((a: any) => a && a.find === find);
        if (!exists) current.push({ find, replacement });
      } else {
        (viteConfig.resolve as any).alias = { ...(current || {}), [find]: replacement };
      }
    };

    addAlias('@sdppp/ui-library', path.resolve(__dirname, '../../src/index.ts'));

    // Allow reading stories from workspace paths if necessary
    (viteConfig.server as any) ??= {};
    (viteConfig.server as any).fs ??= {};
    const currentAllow = (viteConfig.server as any).fs.allow;
    const allow: string[] = Array.isArray(currentAllow) ? currentAllow : [];
    (viteConfig.server as any).fs.allow = allow;

    const roots = [
      path.resolve(__dirname, '../../'),
      path.resolve(__dirname, '../../../')
    ];
    for (const r of roots) {
      if (!allow.includes(r)) allow.push(r);
    }

    return viteConfig;
  }
};

export default config;
