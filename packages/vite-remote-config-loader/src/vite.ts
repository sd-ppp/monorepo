import type { Plugin } from 'vite';
import type { RemoteConfigLoaderOptions, ConfigMeta, ConfigMetaMap, FallbackDataMap } from './types.ts';

const VIRTUAL_MODULE_META = 'virtual:remote-configs-meta';
const VIRTUAL_MODULE_FALLBACK = 'virtual:remote-configs-fallback';

export function remoteConfigLoader(options: RemoteConfigLoaderOptions): Plugin {
  const { configs, defaultLocalStorageKey = 'remote-config' } = options;
  
  let configMeta: ConfigMetaMap = {};
  let fallbackData: FallbackDataMap = {};
  let isInitialized = false;

  // 初始化配置元数据 - 确保在任何情况下都有基本数据
  const initializeConfigs = async () => {
    if (isInitialized) return;
    
    console.log(`[vite-remote-config-loader] Initializing plugin with ${configs.length} configs`);
    
    configMeta = {};
    fallbackData = {};
    
    // 同步创建基本配置元数据
    configs.forEach(config => {
      const meta: ConfigMeta = {
        id: config.id,
        url: config.url,
        localStorageKey: config.localStorageKey ?? `${defaultLocalStorageKey}-${config.id}`
      };
      configMeta[config.id] = meta;
      fallbackData[config.id] = {}; // 默认空对象
    });

    // 异步下载配置数据
    const downloadPromises = configs.map(async (config) => {
      try {
        console.log(`[vite-remote-config-loader] Downloading config: ${config.id} from ${config.url}`);
        
        const response = await fetch(config.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        fallbackData[config.id] = data;
        
        console.log(`[vite-remote-config-loader] Successfully downloaded config: ${config.id}`);
      } catch (error) {
        console.error(`[vite-remote-config-loader] Failed to download config: "${config.id}" from URL: ${config.url}`);
        console.error(`[vite-remote-config-loader] Error details:`, error);
        // 保持默认的空对象
      }
    });
    
    await Promise.all(downloadPromises);
    console.log(`[vite-remote-config-loader] All configs processed. Available IDs:`, Object.keys(configMeta));
    isInitialized = true;
  };

  return {
    name: 'vite-remote-config-loader',
    
    async buildStart() {
      await initializeConfigs();
    },

    async configResolved() {
      // 确保在配置解析后也初始化
      await initializeConfigs();
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_META || id === VIRTUAL_MODULE_FALLBACK) {
        console.log(`[vite-remote-config-loader] Resolving virtual module: ${id}`);
        return id;
      }
    },

    async load(id) {
      // 确保加载虚拟模块时已经初始化
      if (id === VIRTUAL_MODULE_META || id === VIRTUAL_MODULE_FALLBACK) {
        await initializeConfigs();
      }

      if (id === VIRTUAL_MODULE_META) {
        console.log(`[vite-remote-config-loader] Loading meta module with configs:`, Object.keys(configMeta));
        return `export default ${JSON.stringify(configMeta, null, 2)};`;
      }
      
      if (id === VIRTUAL_MODULE_FALLBACK) {
        console.log(`[vite-remote-config-loader] Loading fallback module with data:`, Object.keys(fallbackData));
        return `export default ${JSON.stringify(fallbackData, null, 2)};`;
      }
    },

    transformIndexHtml: {
      order: 'post',
      handler: async (html) => {
        // 确保数据已经初始化
        await initializeConfigs();
        
        // 在HTML中注入全局变量，确保运行时可以访问
        const script = `
<script>
window.__VITE_REMOTE_CONFIG_META__ = ${JSON.stringify(configMeta)};
window.__VITE_REMOTE_CONFIG_FALLBACK__ = ${JSON.stringify(fallbackData)};
console.log('[vite-remote-config-loader] Global config injected:', Object.keys(window.__VITE_REMOTE_CONFIG_META__ || {}));
</script>`;
        return html.replace('<head>', `<head>${script}`);
      }
    }
  };
}