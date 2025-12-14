import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globbySync } from 'globby';
import { parse } from 'yaml';

type WorkspaceManifest = {
  packages?: string[];
};

type WorkspaceStorybookSettings = {
  exclude?: boolean;
  stories?: string[];
};

type PackageManifest = {
  sdpppStorybook?: WorkspaceStorybookSettings;
  chatterStorybook?: WorkspaceStorybookSettings;
  storybook?: WorkspaceStorybookSettings;
  workspaces?: string[] | { packages?: string[] };
};

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(currentDir, '../../..');
const workspaceManifestPath = join(repoRoot, 'pnpm-workspace.yaml');
const FALLBACK_STORY_GLOB = '**/src/**/*.stories.@(ts|tsx|js|jsx|mdx)';
const DEFAULT_STORY_DIRECTORIES = [
  'src/**/*.stories.@(ts|tsx|js|jsx|mdx)',
  'stories/**/*.stories.@(ts|tsx|js|jsx|mdx)',
  '**/stories/**/*.stories.@(ts|tsx|js|jsx|mdx)'
];
const STORY_GLOB_IGNORES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.storybook/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/storybook-static/**'
];
const WORKSPACE_DIRECTORY_IGNORES = ['**/node_modules/**', '**/dist/**', '**/build/**'];

const toPosix = (filePath: string) => filePath.replace(/\\/g, '/');
const toRelativeGlob = (absoluteGlob: string) => {
  const relativePath = relative(currentDir, absoluteGlob);
  if (!relativePath) {
    return toPosix(absoluteGlob);
  }

  return relativePath.startsWith('.')
    ? toPosix(relativePath)
    : toPosix(`./${relativePath}`);
};

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

const toRepoRelative = (absoluteDir: string) => {
  const relativePath = relative(repoRoot, absoluteDir);
  return relativePath ? toPosix(relativePath) : '.';
};

const normaliseWorkspaceGlobs = (
  workspaces: PackageManifest['workspaces']
): string[] => {
  if (!workspaces) {
    return [];
  }

  if (Array.isArray(workspaces)) {
    return workspaces.slice();
  }

  if (Array.isArray(workspaces.packages)) {
    return workspaces.packages.slice();
  }

  return [];
};

const collectStoriesFromDir = (
  storyGlobs: Set<string>,
  processedStoryRoots: Set<string>,
  baseDir: string,
  storySettings: WorkspaceStorybookSettings | null,
  sourceLabel: string
) => {
  if (!storySettings?.stories?.length && storySettings?.exclude) {
    console.info(`[storybook] Skipping stories for ${sourceLabel} (explicit exclude)`);
    return;
  }

  if (!existsSync(baseDir)) {
    return;
  }

  const resolvedDir = toPosix(baseDir);
  if (processedStoryRoots.has(resolvedDir)) {
    return;
  }

  processedStoryRoots.add(resolvedDir);

  const packageStoryGlobs =
    storySettings?.stories && storySettings.stories.length
      ? storySettings.stories
      : DEFAULT_STORY_DIRECTORIES;

  const beforeSize = storyGlobs.size;

  for (const pattern of packageStoryGlobs) {
    if (!pattern.trim()) {
      continue;
    }

    const absoluteGlob = toPosix(join(baseDir, pattern));
    const matches = globbySync(absoluteGlob, {
      absolute: true,
      ignore: STORY_GLOB_IGNORES,
      onlyFiles: true
    });

    for (const match of matches) {
      storyGlobs.add(toRelativeGlob(toPosix(match)));
    }
  }

  const added = storyGlobs.size - beforeSize;
  const repoRelative = toRepoRelative(baseDir);

  if (added > 0) {
    console.info(`[storybook] Added ${added} stories from ${repoRelative}`);
  } else {
    console.info(`[storybook] No stories discovered under ${repoRelative}`);
  }
};

/** Collects every workspace package's story glob so Storybook can load them centrally. */
export const deriveWorkspaceStoryGlobs = (): string[] => {
  const packageJsonPaths = globbySync(buildPackageJsonGlobs(readWorkspacePatterns()), {
    cwd: repoRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  console.info(`[storybook] Found ${packageJsonPaths.length} workspace package manifests to scan`);

  const storyGlobs = new Set<string>();
  const processedStoryRoots = new Set<string>();

  for (const packageJsonPath of packageJsonPaths) {
    const manifest = safeReadPackageJson(packageJsonPath);
    if (!manifest) {
      continue;
    }

    const storySettings = manifest.sdpppStorybook ?? manifest.chatterStorybook ?? manifest.storybook ?? null;

    const baseDir = dirname(packageJsonPath);
    const repoRelative = toRepoRelative(baseDir);

    collectStoriesFromDir(storyGlobs, processedStoryRoots, baseDir, storySettings, repoRelative);

    const workspaceGlobs = normaliseWorkspaceGlobs(manifest.workspaces);
    if (workspaceGlobs.length) {
      const nestedRoots = globbySync(workspaceGlobs, {
        cwd: baseDir,
        onlyDirectories: true,
        absolute: true,
        ignore: WORKSPACE_DIRECTORY_IGNORES,
        expandDirectories: false,
        deep: 1
      });

      for (const nestedRoot of nestedRoots) {
        const nestedPackageJson = join(nestedRoot, 'package.json');
        if (existsSync(nestedPackageJson)) {
          // The nested package will be handled separately when its manifest is processed.
          continue;
        }

        collectStoriesFromDir(
          storyGlobs,
          processedStoryRoots,
          nestedRoot,
          null,
          toRepoRelative(nestedRoot)
        );
      }
    }
  }

  if (!storyGlobs.size) {
    const fallbackGlob = toRelativeGlob(toPosix(join(repoRoot, FALLBACK_STORY_GLOB)));
    console.info(`[storybook] Falling back to umbrella glob ${fallbackGlob}`);
    storyGlobs.add(fallbackGlob);
  }

  console.info(`[storybook] Resolved ${storyGlobs.size} story entries for Storybook preview`);

  return Array.from(storyGlobs);
};
