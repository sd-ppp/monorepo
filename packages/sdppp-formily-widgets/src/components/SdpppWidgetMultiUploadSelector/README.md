# SdpppWidgetMultiUploadSelector

多图上传选择器组件，支持管理多个图片槽位，可以包装 `nomask` 或 `deferred` 变体的上传选择器。

## 功能特性

- ✅ 支持 `nomask` 和 `deferred` 两种变体
- ✅ 动态添加/删除图片槽位
- ✅ 聚合所有槽位的上传状态（uploading/generating/error）
- ✅ 自动过滤空值，只输出有效的图片数据
- ✅ 完整的 TypeScript 类型支持
- ✅ 与 Formily 表单系统无缝集成

## 使用场景

### 1. Deferred 模式（延迟上传 - 默认）

适用于需要在表单提交时才真正上传图片的场景。组件只生成预览和 URI 描述，不立即上传。

```tsx
import { SdpppWidgetMultiUploadSelector } from '@sdppp/formily-widgets';
import type { DeferredUploadValue } from '@sdppp/formily-widgets';

function MyForm() {
  const [images, setImages] = useState<DeferredUploadValue[]>([]);

  return (
    <SdpppWidgetMultiUploadSelector
      variant="deferred"
      maxCount={3}
      workBoundary="uxp://boundary/0/canvas"
      sourceHints={{
        content: 'canvas',
        boundary: 'selection',
      }}
      value={images}
      onChange={setImages}
      onUploadStateChange={(state) => {
        console.log('Aggregated state:', state);
      }}
    />
  );
}
```

### 2. Nomask 模式（立即上传）

适用于需要立即上传图片并获取 URL 的场景。

```tsx
import { SdpppWidgetMultiUploadSelector } from '@sdppp/formily-widgets';

function MyForm() {
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  return (
    <SdpppWidgetMultiUploadSelector
      variant="nomask"
      maxCount={5}
      workBoundary="uxp://boundary/0/canvas"
      value={imageUrls}
      onChange={setImageUrls}
      showActionButtons={true}
    />
  );
}
```

### 3. 与 Formily 集成

```tsx
import { createForm } from '@formily/core';
import { createSchemaField } from '@formily/react';
import { SdpppWidgetMultiUploadSelector } from '@sdppp/formily-widgets';

const SchemaField = createSchemaField({
  components: {
    SdpppWidgetMultiUploadSelector,
  },
});

const form = createForm();

const schema = {
  type: 'object',
  properties: {
    images: {
      type: 'array',
      'x-component': 'SdpppWidgetMultiUploadSelector',
      'x-component-props': {
        variant: 'deferred',
        maxCount: 4,
        workBoundary: 'uxp://boundary/0/canvas',
        sourceHints: {
          content: 'canvas',
          boundary: 'selection',
        },
      },
    },
  },
};

function FormComponent() {
  return (
    <FormProvider form={form}>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

## API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `widgetableId` | `string` | `'sdppp-multi-upload'` | 组件唯一标识 |
| `variant` | `'nomask' \| 'deferred'` | `'deferred'` | 变体选择 |
| `value` | `(string \| DeferredUploadValue)[]` | `[]` | 当前值 |
| `onChange` | `(value) => void` | - | 值变化回调 |
| `onValueChange` | `(value) => void` | - | 值变化回调（备用） |
| `maxCount` | `number` | **必填** | 最大图片数量 |
| `workBoundary` | `string` | **必填** | 工作边界 URI |
| `sourceHints` | `DeferredUploadSelectorSourceHints` | - | 源提示配置（deferred 专用） |
| `label` | `string \| null` | - | 显示标签 |
| `showActionButtons` | `boolean` | `true` | 是否显示操作按钮 |
| `onUploadStateChange` | `(state) => void` | - | 聚合状态变化回调 |
| `externalErrorDismissSignal` | `number` | - | 外部错误消除信号 |

### Types

```typescript
// 变体类型
type MultiUploadSelectorVariant = 'nomask' | 'deferred';

// 单个槽位的状态
interface SlotUploadState {
  status: 'idle' | 'uploading' | 'generating' | 'error';
  errorMessage: string | null;
  progress: { current: number; total: number };
}

// 聚合状态
interface AggregatedUploadState {
  status: 'idle' | 'uploading' | 'generating' | 'error';
  errorMessage: string | null;
  progress: { current: number; total: number };
}

// Deferred 上传值
interface DeferredUploadValue {
  type: 'deferred';
  contentUri: string;
  boundaryUri: string;
  maskUri?: string;
  resourceId?: string;
  previewUrl?: string;
  timestamp?: number;
}

// 源提示配置
interface DeferredUploadSelectorSourceHints {
  content?: 'canvas' | 'curlayer' | null;
  mask?: 'canvas' | 'curlayer' | 'selection' | 'smart_selection' | null;
  boundary?: 'canvas' | 'curlayer' | 'selection' | null;
}
```

## 工作原理

### 1. 槽位管理

- 组件使用 `SlotConfig[]` 管理多个图片槽位
- 每个槽位有唯一的 `key`（使用 UUID 生成）
- 动态添加/删除槽位时，保留现有槽位的状态

### 2. 状态聚合

- 跟踪每个槽位的上传/生成状态
- 自动聚合所有槽位的状态：
  - **错误优先级最高**：任意槽位出错，整体显示错误
  - **上传/生成中**：累加所有槽位的进度
  - **idle**：所有槽位都完成时显示

### 3. 值处理

- **nomask 模式**：每个槽位输出 `string`，最终输出 `string[]`
- **deferred 模式**：每个槽位输出 `DeferredUploadValue`，最终输出 `DeferredUploadValue[]`
- 自动过滤空值，只保留有效数据

### 4. 资源清理

- 槽位删除时，自动清理该槽位的状态和错误信号
- 组件卸载时，依赖 `useResourceHandleManager` 清理所有临时资源

## 注意事项

### Deferred 模式的批量上传

在 deferred 模式下，组件只生成预览和 URI 描述。在表单提交时，需要批量调用上传函数：

```typescript
const handleSubmit = async (values: any) => {
  const images: DeferredUploadValue[] = values.images || [];
  
  // 批量上传
  const uploadedUrls = await Promise.all(
    images.map(async (item) => {
      if (item.resourceId) {
        return await uploadResource(item.resourceId);
      }
      return null;
    })
  );
  
  // 过滤失败的上传
  const validUrls = uploadedUrls.filter(Boolean);
  
  // 提交最终数据
  await submitForm({ ...values, images: validUrls });
};
```

### 性能优化

- 使用 `useMemo` 缓存计算结果
- 使用 `useCallback` 避免不必要的重渲染
- 状态更新时检查是否真的有变化，避免无效更新

### 类型安全

组件完全支持 TypeScript，根据 `variant` 自动推断值类型：

```typescript
// Nomask 模式
<SdpppWidgetMultiUploadSelector
  variant="nomask"
  value={stringArray}  // string[]
  onChange={(urls: string[]) => {}}
/>

// Deferred 模式
<SdpppWidgetMultiUploadSelector
  variant="deferred"
  value={deferredArray}  // DeferredUploadValue[]
  onChange={(values: DeferredUploadValue[]) => {}}
/>
```

## 示例

完整示例请参考：
- `playground/examples/MultiUploadExample.tsx`
- Storybook stories（如果有）

## 相关组件

- `SdpppWidgetUploadSelectorRouter` - 单图上传路由组件
- `SdpppWidgetUploadSelector` - Nomask 单图上传
- `SdpppWidgetDeferredUploadSelector` - Deferred 单图上传
