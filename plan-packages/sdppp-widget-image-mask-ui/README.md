# @sdppp/widget-image-mask-ui

轻量的、无交互的 UI 组件集合，用于图片/遮罩/视频/本地图片包的选择预览。支持通过 Provider 注入外部 API，无需全局 Store。

## 组件列表

- ImageSelector：单图，左侧包含“默认继承+修改”行、主图按钮（带 auto）、分隔线、遮罩按钮；右侧预览。
- MultiImageSelector：多图，每个槽位复用完整的 `ImageSelector` 行为，支持独立的 Auto/Action 流程与上传。
- MaskSelector：遮罩，左侧包含“+ 选区遮罩”“+ 图层遮罩”“重置”三个同宽按钮；右侧预览（白底）。
- SingleVideoSelector：单视频，左侧一个大号“+ 添加视频”按钮；右侧预览。
- LocalImagePackSelector：本地图片包，左侧一个大号“+ 本地图片包”按钮；右侧预览。

## Provider 与 Context

组件通过 `WidgetImageMaskProvider` 注入所需的外部 API、文案函数以及日志/调试选项，替代原有的全局 Store。接口命名与 `@sdppp/resourcing` 中的 action/resolver 保持一致：

- `'resource.thumbnail'(params): Promise<{ thumbnail?: string; width?: number; height?: number; error?: string }>`：生成、缓存缩略图。
- `'resource.file.createFromLocal'(params?): Promise<{ resource?: string; thumbnail?: string; error?: string }>`：调起本地文件选择，生成资源。
- `'resource.file.createFromCBM'(params): Promise<{ resource?: string; thumbnail?: string; error?: string }>`：基于内容/边界/遮罩句柄合成资源。
- `'resource.boundary.normalize'({ boundary }): Promise<{ boundary?: string; error?: string }>`：把边界句柄归一化为矩形。
- `'resource.layer.resolve'({ uri, type }): Promise<{ uri?: string; error?: string }>`：将内容/遮罩句柄解析为具体图层（`type` 取 `content` 或 `mask`）。
- `t(key, options?): string`：国际化文案函数，通常可直接透传 `i18next.t`。
- `logger(...args: string[])`：统一日志输出函数，组件内部仅通过此函数打印调试信息。
- `debug?: boolean`：开启后在调试视图中暴露更多状态（如预览侧的 debug 按钮等）。
- `uploadPassHandlers`：上传调度接口集合，默认为空实现，包含 `runUploadPassOnce(pass) => Promise<string>`、`addUploadPass(pass) => string`、`removeUploadPass(pass) => void`。

> TODO: 当需要重新校验 docId 或监听遮罩实时更新时，恢复对 `maskUri` 的严格解析并明确处理 `uxp://file/...` 形态的遮罩。

### Provider 使用示例

```tsx
import React from 'react';
import { WidgetImageMaskProvider, type WidgetImageMaskActions } from '@sdppp/widget-image-mask-ui/context/WidgetImageMaskContext';
import { ImageSelector } from '@sdppp/widget-image-mask-ui/components/ImageSelector';
import { MultiImageSelector } from '@sdppp/widget-image-mask-ui/components/MultiImageSelector';
import { MaskSelector } from '@sdppp/widget-image-mask-ui/components/MaskSelector';
import { SingleVideoSelector } from '@sdppp/widget-image-mask-ui/components/SingleVideoSelector';
import { LocalImagePackSelector } from '@sdppp/widget-image-mask-ui/components/LocalImagePackSelector';

const actions: WidgetImageMaskActions = {
  'resource.thumbnail': async ({ resource }) => {
    // TODO: 调用 resource.thumbnail
    return { thumbnail: null, width: undefined, height: undefined };
  },
  'resource.file.createFromLocal': async () => {
    // TODO: 调起 resource.file.createFromLocal
    return { resource: 'uxp://file/example', thumbnail: null };
  },
  'resource.file.createFromCBM': async ({ contentUri, boundaryUri, maskUri }) => {
    // TODO: 调起 resource.file.createFromCBM
    return { resource: contentUri ?? maskUri ?? boundaryUri ?? null };
  },
  'resource.boundary.normalize': async ({ boundary }) => {
    // TODO: 调起 boundary.normalize
    return { boundary };
  },
  'resource.layer.resolve': async ({ uri, type }) => {
    // TODO: 调起 layer.resolve(type="content")
    return { uri };
  },
};

const t = (key: string, options?: Record<string, unknown>) => {
  // TODO: 接入宿主多语言方案
  return options?.defaultValue ? String(options.defaultValue) : key;
};

const logger = (...args: string[]) => {
  console.log('[WidgetImageMask]', ...args);
};

export default function Demo() {
  return (
    <WidgetImageMaskProvider
      actions={actions}
      t={t}
      logger={logger}
      debug
      uploadPassHandlers={{
        runUploadPassOnce: async pass => {
          console.log('[mock upload] run once', pass);
          return '';
        },
        addUploadPass: pass => {
          console.log('[mock upload] add', pass);
          return 'mock-upload-id';
        },
        removeUploadPass: pass => {
          console.log('[mock upload] remove', pass);
        },
      }}
    >
      {/* 单图 */}
      <ImageSelector
        widgetableId="image-1"
        value={["https://picsum.photos/seed/sdppp-1/400/300"]}
        workBoundary="uxp://boundary/canvas"
      />

      {/* 多图（每个槽位展示同样的左侧布局） */}
      <MultiImageSelector
        widgetableId="image-multi"
        maxCount={3}
        value={[
          "https://picsum.photos/seed/sdppp-2/400/300",
          "https://picsum.photos/seed/sdppp-3/400/300",
          "https://picsum.photos/seed/sdppp-4/400/300",
        ]}
        workBoundary="uxp://boundary/canvas"
        showActionButtons
      />

      {/* 遮罩（左侧三按钮） */}
      <MaskSelector
        widgetableId="mask-1"
        value={["https://picsum.photos/seed/sdppp-mask-1/400/300"]}
        workBoundary="uxp://boundary/1/canvas"
      />

      {/* 单视频（大号 + 按钮） */}
      <SingleVideoSelector
        widgetableId="video-1"
        value={["https://picsum.photos/seed/sdppp-video/400/300"]}
      />

      {/* 本地图片包（大号 + 按钮） */}
      <LocalImagePackSelector
        widgetableId="local-pack-1"
        value={["https://picsum.photos/seed/sdppp-local-pack/400/300"]}
      />
    </WidgetImageMaskProvider>
  );
}
```

## Hooks


## Widget 渲染器（可选）

使用 `createImageMaskWidgetRouter` 可为 widgetable 构建渲染器，路由器会根据传入的 hint 或 widget 配置选择合适的 Selector：

```ts
import {
  createImageMaskWidgetRouter,
  imageMaskWidgetRouter,
} from '@sdppp/widget-image-mask-ui/widgets/widget-router';

// 根据 widget.options.maxCount 自动判定单图/多图。
const autoRenderer = imageMaskWidgetRouter;

// 强制指定渲染单图 Selector。
const singleImageRenderer = createImageMaskWidgetRouter({ hint: 'single-image' });

// 渲染遮罩 Selector。
const maskRenderer = createImageMaskWidgetRouter({ hint: 'masks' });
```

如需批量注册，可在 `widgetable` 注册表中使用生成的 renderer。

> 提示：当前组件仅负责 UI 呈现与布局（禁用状态），不包含交互逻辑；实际上传/同步等能力请在 Provider 注入的 API 或上层业务中实现。
