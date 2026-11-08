import nxPlugin from '@nx/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const sourceFiles = [
  'packages/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
  'capabilities/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
  'internals/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
  'plan-packages/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
  'release-repos/sd-ppp/typescripts/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
  'build/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'
];

const commonIgnores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  '**/.nx/**',
  'packages/sdppp-photoshop/plugin/**',
  'packages/sdpppx-services/demo/**',
  'packages/sdppp-ui-library/playground/**',
  'plan-packages/mock-photoshop/playground/**',
  'plan-packages/storybook/storybook-static/**',
  'release-repos/sd-ppp/javascript/**',
  'release-repos/sd-ppp/static/**',
  'release-repos/sd-ppp/typescripts/_build/**',
  'release-repos/sd-ppp/typescripts/test/**'
];

const depConstraints = [
  {
    sourceTag: 'scope:workspace',
    onlyDependOnLibsWithTags: ['*']
  },
  {
    sourceTag: 'scope:app',
    onlyDependOnLibsWithTags: [
      'scope:app',
      'scope:capability',
      'scope:ui',
      'scope:infra',
      'scope:tool'
    ]
  },
  {
    sourceTag: 'scope:capability',
    onlyDependOnLibsWithTags: [
      'scope:capability',
      'scope:ui',
      'scope:infra',
      'scope:tool'
    ]
  },
  {
    sourceTag: 'scope:ui',
    onlyDependOnLibsWithTags: [
      'scope:ui',
      'scope:capability',
      'scope:infra',
      'scope:tool'
    ]
  },
  {
    sourceTag: 'scope:infra',
    onlyDependOnLibsWithTags: [
      'scope:infra',
      'scope:capability',
      'scope:tool',
      'scope:app'
    ]
  },
  {
    sourceTag: 'scope:tool',
    onlyDependOnLibsWithTags: [
      'scope:tool',
      'scope:infra',
      'scope:capability',
      'scope:ui'
    ]
  }
];

export default [
  {
    ignores: commonIgnores
  },
  {
    files: sourceFiles,
    plugins: {
      '@nx': nxPlugin
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: [],
          depConstraints
        }
      ]
    }
  }
];
