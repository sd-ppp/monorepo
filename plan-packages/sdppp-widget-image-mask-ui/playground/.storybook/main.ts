import type { StorybookConfig } from '@storybook/react-vite';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
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
    // Normalize alias to support both array and object forms
    viteConfig.resolve ??= {};
    const addAlias = (find: string, replacement: string) => {
      const current = (viteConfig.resolve as any).alias;
      if (Array.isArray(current)) {
        const exists = current.find((a: any) => a && a.find === find);
        if (!exists) current.push({ find, replacement });
      } else {
        (viteConfig.resolve as any).alias = { ...(current || {}), [find]: replacement };
      }
    };

    addAlias('@sdppp/widget-image-mask-ui', path.resolve(__dirname, '../../src'));
    addAlias(
      '@sdppp/ui-library',
      path.resolve(__dirname, '../../../../packages/sdppp-ui-library/src/index.ts')
    );
    addAlias(
      '@sdppp/common',
      path.resolve(__dirname, '../../../../packages/ps-common/index.ts')
    );
    addAlias(
      '@sdppp/resourcing',
      path.resolve(__dirname, '../../../../packages/resourcing/src')
    );

    // Allow reading stories from workspace paths
    (viteConfig.server as any) ??= {};
    (viteConfig.server as any).fs ??= {};
    const currentAllow = (viteConfig.server as any).fs.allow;
    const allow: string[] = Array.isArray(currentAllow) ? currentAllow : [];
    (viteConfig.server as any).fs.allow = allow;

    const roots = [
      path.resolve(__dirname, '../../'),
      path.resolve(__dirname, '../../../../packages/sdppp-ui-library'),
      path.resolve(__dirname, '../../../../packages/ps-common'),
      path.resolve(__dirname, '../../../'),
    ];
    for (const r of roots) {
      if (!allow.includes(r)) allow.push(r);
    }

    const uploadDir = path.join(os.tmpdir(), 'sdppp-storybook-mock-uploads');
    const ensureUploadDir = async () => {
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[storybook/upload] failed to ensure upload dir', error);
      }
    };

    const mimeToExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };
    const extToMime = Object.fromEntries(
      Object.entries(mimeToExt).map(([mime, ext]) => [ext, mime])
    );

    viteConfig.plugins ??= [];
    viteConfig.plugins.push({
      name: 'sdppp-storybook-mock-upload',
      configureServer(server) {
        void ensureUploadDir();

        server.middlewares.use('/api/mock-upload', (req, res, next) => {
          if (req.method !== 'POST') {
            next();
            return;
          }

          const chunks: Uint8Array[] = [];
          req.on('data', chunk => {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          });
          req.on('error', error => {
            next(error);
          });
          req.on('end', async () => {
            try {
              await ensureUploadDir();
              const raw = Buffer.concat(chunks).toString('utf8');
              const payload = raw ? JSON.parse(raw) : {};
              const { filename, dataUrl } = payload ?? {};
              if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
                res.statusCode = 400;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ error: 'invalid-data-url' }));
                return;
              }

              const [meta, base64] = dataUrl.split(',');
              if (!base64) {
                res.statusCode = 400;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ error: 'missing-payload' }));
                return;
              }

              const mimeMatch = meta.match(/^data:(.*?);/);
              const mime = mimeMatch?.[1] ?? 'application/octet-stream';
              const buffer = Buffer.from(base64, 'base64');

              const provided = typeof filename === 'string' ? filename : 'upload';
              const basename = path.basename(provided).replace(/[^a-zA-Z0-9_.-]/g, '') || 'upload';
              const providedExt = path.extname(basename);
              const providedName = providedExt ? basename.slice(0, -providedExt.length) : basename;
              const fallbackExt = mimeToExt[mime] ? `.${mimeToExt[mime]}` : '';
              const finalExt = providedExt || fallbackExt || '.bin';
              const finalName = `${randomUUID()}-${providedName || 'upload'}${finalExt}`;
              const targetPath = path.join(uploadDir, finalName);

              await fs.writeFile(targetPath, buffer);

              res.statusCode = 200;
              res.setHeader('content-type', 'application/json');
              res.end(
                JSON.stringify({
                  url: `/mock-uploads/${finalName}`,
                  mime,
                })
              );
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: 'upload-failed' }));
              next(error);
            }
          });
        });

        server.middlewares.use('/mock-uploads', (req, res, next) => {
          if (req.method !== 'GET') {
            next();
            return;
          }

          const requestPath = req.url ?? '/';
          const safePath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
          const resolved = path.resolve(uploadDir, safePath);
          if (!resolved.startsWith(uploadDir)) {
            res.statusCode = 403;
            res.end('forbidden');
            return;
          }

          fs.stat(resolved)
            .then(stat => {
              if (!stat.isFile()) {
                res.statusCode = 404;
                res.end('not found');
                return;
              }
              const ext = path.extname(resolved).slice(1).toLowerCase();
              const mime = extToMime[ext] ?? 'application/octet-stream';
              res.statusCode = 200;
              res.setHeader('content-type', mime);
              res.setHeader('cache-control', 'no-cache');
              createReadStream(resolved)
                .on('error', streamErr => {
                  res.statusCode = 500;
                  res.end('stream error');
                  next(streamErr);
                })
                .pipe(res);
            })
            .catch(() => {
              res.statusCode = 404;
              res.end('not found');
            });
        });
      },
    });

    return viteConfig;
  }
};

export default config;
