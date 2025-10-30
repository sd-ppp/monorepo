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
    viteConfig.resolve ??= {};
    viteConfig.resolve.alias ??= [] as any;
    const aliasEntry = {
      find: '@sdppp/ui-library',
      replacement: path.resolve(__dirname, '../../src/index.ts'),
    } as any;
    // Avoid duplicate alias entries
    const existing = Array.isArray(viteConfig.resolve.alias)
      ? viteConfig.resolve.alias.find((a: any) => a.find === aliasEntry.find)
      : undefined;
    if (!existing) {
      (viteConfig.resolve.alias as any[]).push(aliasEntry);
    }
    return viteConfig;
  }
};

export default config;
