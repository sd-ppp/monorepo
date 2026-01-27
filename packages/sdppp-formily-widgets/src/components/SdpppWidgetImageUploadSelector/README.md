# SdpppWidgetImageUploadSelector

智能图片上传选择器 - 根据 `maxCount` 自动选择单图或多图模式。

## ✨ 核心特性

- ✅ **智能切换**: 根据 `maxCount` 自动使用单图或多图组件
- ✅ **统一 API**: 单图和多图使用相同的组件和属性
- ✅ **简化 Schema**: Formily Schema 不需要区分 `type: 'string'` 和 `type: 'array'`
- ✅ **类型安全**: 根据 `maxCount` 自动推断值类型
- ✅ **零配置**: 默认单图模式，设置 `maxCount > 1` 即可切换多图

---

## 🚀 快速开始

### 单图模式（默认）

```tsx
import { SdpppWidgetImageUploadSelector } from '@sdppp/formily-widgets';

function App() {
  const [avatar, setAvatar] = useState('');

  return (
    <SdpppWidgetImageUploadSelector
      workBoundary="uxp://boundary/0/canvas"
      value={avatar}
      onChange={setAvatar}
    />
  );
}
```

### 多图模式（maxCount > 1）

```tsx
function App() {
  const [images, setImages] = useState([]);

  return (
    <SdpppWidgetImageUploadSelector
      maxCount={5}  // 🔥 自动切换为多图模式
      workBoundary="uxp://boundary/0/canvas"
      value={images}
      onChange={setImages}
    />
  );
}
```

---

## 📋 Formily Schema 用法

### 最大优势：不需要区分 type！

```typescript
import { createSchemaField } from '@formily/react';
import { SdpppWidgetImageUploadSelector } from '@sdppp/formily-widgets';

const SchemaField = createSchemaField({
  components: {
    SdpppWidgetImageUploadSelector,
  },
});

const schema = {
  type: 'object',
  properties: {
    // 单图字段
    avatar: {
      type: 'string',  // 单图也是 string
      title: '头像',
      'x-component': 'SdpppWidgetImageUploadSelector',
      'x-component-props': {
        variant: 'nomask',
        workBoundary: 'uxp://boundary/0/canvas',
      },
    },
    
    // 多图字段
    productImages: {
      type: 'string',  // 🔥 不需要写 array！
      title: '产品图片',
      'x-component': 'SdpppWidgetImageUploadSelector',
      'x-component-props': {
        variant: 'nomask',
        maxCount: 5,  // 🔥 maxCount > 1 自动切换多图
        workBoundary: 'uxp://boundary/0/canvas',
      },
    },
  },
};
```

---

## 🎯 工作原理

组件内部根据 `maxCount` 自动路由：

```
SdpppWidgetImageUploadSelector
  │
  ├─ maxCount === 1（默认）
  │   └─ SdpppWidgetUploadSelectorRouter（单图）
  │       ├─ SdpppWidgetUploadSelector (nomask)
  │       └─ SdpppWidgetDeferredUploadSelector (deferred)
  │
  └─ maxCount > 1
      └─ SdpppWidgetMultiUploadSelector（多图）
          └─ 管理多个 SdpppWidgetUploadSelectorRouter
```

---

## 📚 完整示例

### 示例 1: 产品发布表单

```typescript
import { createForm } from '@formily/core';
import { createSchemaField, FormProvider } from '@formily/react';
import { FormItem, Input, Submit, FormLayout } from '@formily/antd-v5';
import { SdpppWidgetImageUploadSelector } from '@sdppp/formily-widgets';

const SchemaField = createSchemaField({
  components: {
    FormItem,
    Input,
    SdpppWidgetImageUploadSelector,
  },
});

const schema = {
  type: 'object',
  properties: {
    productName: {
      type: 'string',
      title: '产品名称',
      required: true,
      'x-component': 'Input',
      'x-decorator': 'FormItem',
    },
    
    // 单图：产品封面
    coverImage: {
      type: 'string',
      title: '产品封面',
      required: true,
      'x-component': 'SdpppWidgetImageUploadSelector',
      'x-component-props': {
        variant: 'nomask',
        workBoundary: 'uxp://boundary/0/canvas',
      },
      'x-decorator': 'FormItem',
    },
    
    // 多图：产品图片
    productImages: {
      type: 'string',  // 🔥 不是 array
      title: '产品图片',
      required: true,
      'x-component': 'SdpppWidgetImageUploadSelector',
      'x-component-props': {
        variant: 'nomask',
        maxCount: 5,  // 🔥 多图模式
        workBoundary: 'uxp://boundary/0/canvas',
      },
      'x-decorator': 'FormItem',
      'x-decorator-props': {
        tooltip: '最多上传 5 张产品图片',
      },
    },
  },
};

const form = createForm();

export default function ProductForm() {
  const handleSubmit = (values: any) => {
    console.log('提交:', values);
    // values.coverImage: string
    // values.productImages: string[]
  };

  return (
    <FormProvider form={form}>
      <FormLayout labelCol={6} wrapperCol={18}>
        <SchemaField schema={schema} />
        <FormItem wrapperCol={{ offset: 6 }}>
          <Submit onSubmit={handleSubmit}>发布产品</Submit>
        </FormItem>
      </FormLayout>
    </FormProvider>
  );
}
```

### 示例 2: 用户资料表单

```typescript
const userSchema = {
  type: 'object',
  properties: {
    // 单图：头像（固定 1 张）
    avatar: {
      type: 'string',
      title: '头像',
      'x-component': 'SdpppWidgetImageUploadSelector',
      'x-component-props': {
        variant: 'nomask',
        maxCount: 1,  // 明确指定单图
        workBoundary: 'uxp://boundary/0/canvas',
        showActionButtons: false,  // 隐藏按钮
      },
      'x-decorator': 'FormItem',
    },
    
    // 多图：相册（最多 10 张）
    gallery: {
      type: 'string',
      title: '个人相册',
      'x-component': 'SdpppWidgetImageUploadSelector',
      'x-component-props': {
        variant: 'nomask',
        maxCount: 10,  // 多图模式
        workBoundary: 'uxp://boundary/0/canvas',
      },
      'x-decorator': 'FormItem',
    },
  },
};
```

---

## ⚙️ API 文档

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxCount` | `number` | `1` | 🔥 最大图片数量（决定单图/多图模式） |
| `variant` | `'nomask' \| 'deferred'` | `'deferred'` | 上传模式 |
| `workBoundary` | `string` | **必填** | 工作边界 URI |
| `value` | `string \| DeferredUploadValue \| array` | - | 当前值 |
| `onChange` | `function` | - | 值变化回调 |
| `sourceHints` | `object` | - | 源提示（deferred 专用） |
| `showActionButtons` | `boolean` | `true` | 显示操作按钮 |

### 值类型自动推断

```typescript
// maxCount === 1（单图）
value: string | DeferredUploadValue
onChange: (value: string | DeferredUploadValue) => void

// maxCount > 1（多图）
value: (string | DeferredUploadValue)[]
onChange: (value: (string | DeferredUploadValue)[]) => void
```

---

## 🆚 对比：旧方式 vs 新方式

### ❌ 旧方式（需要区分组件）

```typescript
const schema = {
  type: 'object',
  properties: {
    // 单图：使用 SdpppWidgetUploadSelectorRouter
    avatar: {
      type: 'string',
      'x-component': 'SdpppWidgetUploadSelectorRouter',
      'x-component-props': { /* ... */ },
    },
    
    // 多图：使用 SdpppWidgetMultiUploadSelector
    images: {
      type: 'array',  // 需要写 array
      'x-component': 'SdpppWidgetMultiUploadSelector',
      'x-component-props': {
        maxCount: 5,
        /* ... */
      },
    },
  },
};
```

### ✅ 新方式（统一组件）

```typescript
const schema = {
  type: 'object',
  properties: {
    // 单图：相同的组件
    avatar: {
      type: 'string',
      'x-component': 'SdpppWidgetImageUploadSelector',
      'x-component-props': { /* ... */ },
    },
    
    // 多图：相同的组件，只改 maxCount
    images: {
      type: 'string',  // 🔥 不需要 array
      'x-component': 'SdpppWidgetImageUploadSelector',
      'x-component-props': {
        maxCount: 5,  // 🔥 自动切换多图
        /* ... */
      },
    },
  },
};
```

---

## 💡 最佳实践

### 1. 单图场景

```typescript
// 头像、封面图、证件照等
{
  avatar: {
    type: 'string',
    'x-component': 'SdpppWidgetImageUploadSelector',
    'x-component-props': {
      variant: 'nomask',
      workBoundary: 'uxp://boundary/0/canvas',
      showActionButtons: false,  // 单图可隐藏按钮
    },
  },
}
```

### 2. 多图场景

```typescript
// 商品图、相册、附件等
{
  productImages: {
    type: 'string',
    'x-component': 'SdpppWidgetImageUploadSelector',
    'x-component-props': {
      variant: 'nomask',
      maxCount: 5,
      workBoundary: 'uxp://boundary/0/canvas',
    },
    'x-validator': [
      {
        validator: (v) => {
          if (!v || (Array.isArray(v) && v.length === 0)) {
            return '请至少上传 1 张图片';
          }
        },
      },
    ],
  },
}
```

### 3. 验证规则

单图和多图的验证略有不同：

```typescript
// 单图验证
'x-validator': [
  {
    validator: (value: string) => {
      if (!value || value.trim() === '') {
        return '请上传图片';
      }
    },
  },
]

// 多图验证
'x-validator': [
  {
    validator: (value: string[]) => {
      if (!value || value.length === 0) {
        return '请至少上传 1 张图片';
      }
      if (value.length < 3) {
        return '建议上传至少 3 张图片';
      }
    },
  },
]
```

---

## 🎨 常见场景

### 场景 1: 证件上传（单图 + 隐藏按钮）

```typescript
{
  idCard: {
    type: 'string',
    title: '身份证照片',
    required: true,
    'x-component': 'SdpppWidgetImageUploadSelector',
    'x-component-props': {
      variant: 'nomask',
      maxCount: 1,
      workBoundary: 'uxp://boundary/0/canvas',
      showActionButtons: false,
    },
    'x-decorator': 'FormItem',
  },
}
```

### 场景 2: 商品主图（多图）

```typescript
{
  mainImages: {
    type: 'string',
    title: '商品主图',
    required: true,
    'x-component': 'SdpppWidgetImageUploadSelector',
    'x-component-props': {
      variant: 'nomask',
      maxCount: 5,
      workBoundary: 'uxp://boundary/0/canvas',
    },
    'x-decorator': 'FormItem',
    'x-decorator-props': {
      tooltip: '第一张为主图',
    },
  },
}
```

### 场景 3: 可选相册（多图 + 非必填）

```typescript
{
  gallery: {
    type: 'string',
    title: '相册',
    'x-component': 'SdpppWidgetImageUploadSelector',
    'x-component-props': {
      variant: 'nomask',
      maxCount: 10,
      workBoundary: 'uxp://boundary/0/canvas',
    },
    'x-decorator': 'FormItem',
    // 不设置 required，表示可选
  },
}
```

---

## 🔄 从旧组件迁移

如果你已经在使用 `SdpppWidgetUploadSelectorRouter` 或 `SdpppWidgetMultiUploadSelector`，迁移很简单：

### 迁移单图组件

```diff
- 'x-component': 'SdpppWidgetUploadSelectorRouter',
+ 'x-component': 'SdpppWidgetImageUploadSelector',
  'x-component-props': {
    variant: 'nomask',
    workBoundary: 'uxp://boundary/0/canvas',
  },
```

### 迁移多图组件

```diff
- type: 'array',
+ type: 'string',
- 'x-component': 'SdpppWidgetMultiUploadSelector',
+ 'x-component': 'SdpppWidgetImageUploadSelector',
  'x-component-props': {
    variant: 'nomask',
    maxCount: 5,
    workBoundary: 'uxp://boundary/0/canvas',
  },
```

---

## 🎉 总结

`SdpppWidgetImageUploadSelector` 是最推荐使用的图片上传组件：

✅ **统一 API**: 单图和多图使用同一个组件  
✅ **自动切换**: 根据 `maxCount` 自动选择模式  
✅ **简化 Schema**: 不需要区分 `type: 'string'` 和 `type: 'array'`  
✅ **类型安全**: 自动推断值类型  
✅ **向后兼容**: 旧组件仍可使用  

现在就开始使用吧！🚀
