import type { StorybookConfig } from '@storybook/react-vite';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globbySync } from 'globby';
import { parse } from 'yaml';
import { deriveWorkspaceStoryGlobs } from './workspace-stories.ts';

type WorkspaceManifest = {
  packages?: string[];
};

type PackageManifest = {
  name?: string;
  workspaces?: string[] | { packages?: string[] };
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, '../../..');
const workspaceManifestPath = resolve(repoRoot, 'pnpm-workspace.yaml');
const STORYBOOK_PACKAGE_IGNORES = ['**/node_modules/**', '**/dist/**'];

const readWorkspacePatterns = (): string[] => {
  if (!existsSync(workspaceManifestPath)) {
    return ['.'];
  }

  const raw = readFileSync(workspaceManifestPath, 'utf8');
  const manifest = parse(raw) as WorkspaceManifest | null;

  if (!manifest?.packages?.length) {
    return ['.'];
  }

  return manifest.packages.map(pattern => pattern.trim()).filter(Boolean);
};

const buildPackageJsonGlobs = (patterns: string[]) =>
  patterns.map(pattern => {
    const sanitized = pattern.replace(/\/+$/g, '');
    return sanitized ? `${sanitized}/package.json` : 'package.json';
  });

const safeReadPackageJson = (packageJsonPath: string): PackageManifest | null => {
  try {
    return JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageManifest;
  } catch (error) {
    console.warn(`[storybook] Failed to parse ${packageJsonPath}`, error);
    return null;
  }
};

const deriveWorkspaceAliases = () => {
  const packageJsonPaths = globbySync(buildPackageJsonGlobs(readWorkspacePatterns()), {
    cwd: repoRoot,
    absolute: true,
    ignore: STORYBOOK_PACKAGE_IGNORES
  });

  const aliasByName = new Map<string, string>();

  for (const packageJsonPath of packageJsonPaths) {
    const manifest = safeReadPackageJson(packageJsonPath);
    if (!manifest?.name || manifest.workspaces) {
      continue;
    }

    aliasByName.set(manifest.name, dirname(packageJsonPath));
  }

  return Array.from(aliasByName.entries()).map(([find, replacement]) => ({
    find,
    replacement
  }));
};

const config: StorybookConfig = {
  stories: deriveWorkspaceStoryGlobs(),
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  docs: {
    autodocs: 'tag'
  },
  core: {
    disableTelemetry: true
  },
  viteFinal: async (config) => {
    const workspaceAliases = deriveWorkspaceAliases();
    const existingAlias = config.resolve?.alias ?? [];
    const aliasArray = Array.isArray(existingAlias)
      ? existingAlias.slice()
      : Object.entries(existingAlias).map(([find, replacement]) => ({
          find,
          replacement
        }));
    const knownAliases = new Set(aliasArray.map(alias => alias.find));
    const ensureAlias = (find: string, replacement: string) => {
      if (knownAliases.has(find)) {
        return;
      }

      aliasArray.push({ find, replacement });
      knownAliases.add(find);
    };

    ensureAlias(
      '@storybook/react/dist/entry-preview-docs.mjs',
      '@storybook/react/dist/entry-preview-docs.js'
    );
    ensureAlias(
      '@storybook/react/dist/entry-preview-docs',
      '@storybook/react/dist/entry-preview-docs.js'
    );
    ensureAlias('@storybook/react/dist/entry-preview.mjs', '@storybook/react/dist/entry-preview.js');
    ensureAlias('@storybook/react/dist/entry-preview', '@storybook/react/dist/entry-preview.js');
    ensureAlias(
      '@storybook/react/dist/entry-preview-argtypes.mjs',
      '@storybook/react/dist/entry-preview-argtypes.js'
    );
    ensureAlias(
      '@storybook/react/dist/entry-preview-argtypes',
      '@storybook/react/dist/entry-preview-argtypes.js'
    );
    ensureAlias(
      '@storybook/react/dist/entry-preview-rsc.mjs',
      '@storybook/react/dist/entry-preview-rsc.js'
    );
    ensureAlias(
      '@storybook/react/dist/entry-preview-rsc',
      '@storybook/react/dist/entry-preview-rsc.js'
    );

    aliasArray.push({
      find: /@storybook\/react\/dist\/(.+)\.mjs$/,
      replacement: '@storybook/react/dist/$1.js'
    });

    for (const alias of workspaceAliases) {
      if (knownAliases.has(alias.find)) {
        continue;
      }

      aliasArray.push(alias);
      knownAliases.add(alias.find);
    }

    console.info(
      `[storybook] Applied ${aliasArray.length} Vite aliases (workspace: ${workspaceAliases.length})`
    );

    const storybookMjsResolver = {
      name: 'storybook-mjs-resolver',
      enforce: 'pre' as const,
      async resolveId(this: any, source: string, importer: string | undefined, options: any) {
        const directReplacements: Record<string, string> = {
          '@storybook/react/dist/entry-preview-docs.mjs':
            '@storybook/react/dist/entry-preview-docs.js',
          '@storybook/react/dist/entry-preview.mjs':
            '@storybook/react/dist/entry-preview.js',
          '@storybook/react/dist/entry-preview-argtypes.mjs':
            '@storybook/react/dist/entry-preview-argtypes.js',
          '@storybook/react/dist/entry-preview-rsc.mjs':
            '@storybook/react/dist/entry-preview-rsc.js'
        };

        const replacement = directReplacements[source];
        if (replacement) {
          return this.resolve(replacement, importer, { ...options, skipSelf: true });
        }

        const match = source.match(/^@storybook\/react\/dist\/(.+)\.mjs$/);
        if (match) {
          const target = `@storybook/react/dist/${match[1]}.js`;
          return this.resolve(target, importer, { ...options, skipSelf: true });
        }

        return null;
      }
    };

    return {
      ...config,
      resolve: {
        ...(config.resolve ?? {}),
        alias: aliasArray
      },
      plugins: [...(config.plugins ?? []), storybookMjsResolver]
    };
  }
};

export default config;
