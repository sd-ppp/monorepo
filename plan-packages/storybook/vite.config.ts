import { defineConfig } from 'vite';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const currentDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(currentDir, '..', '..');

const antdDir = (() => {
  try {
    return dirname(require.resolve('antd/package.json'));
  } catch {
    return resolve(repoRoot, 'node_modules', 'antd');
  }
})();

export default defineConfig({
  resolve: {
    alias: {
      '~antd': antdDir
    }
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        paths: ['node_modules', antdDir]
      }
    }
  }
});
