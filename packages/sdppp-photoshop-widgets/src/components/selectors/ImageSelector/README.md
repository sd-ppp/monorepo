# ImageSelector Module Layout

## 入口
- `index.tsx`：组合各个子组件，连接状态、计算结果和上传流程，负责整体排版与 props 分发。

## Hooks
- `hooks/useImageSelectorState.ts`：集中管理本地状态（来源模式、URI、自动模式等），并提供必要的派生值与动作。
- `hooks/useImageSelectorComputed.tsx`：在视图渲染前整理文案、图标、预览地址、调试信息等派生数据。
- `hooks/useImageUploadWorkflow.ts`：封装上传/同步流程，包括自动上传通道、手动上传和来源模式切换等副作用。

## UI 组件
- `AutoSyncColumn.tsx`：左侧 auto/sync 控制列，包裹两个 Antd 按钮。
- `PreviewPanel.tsx`：中部预览区域，负责图像展示与状态栏（来源模式切换按钮、当前状态文案）。
- `ActionButtons.tsx`：右侧操作按钮堆栈，处理裁剪、扫描及兜底上传按钮。

## 公共定义
- `constants.ts`：尺寸、按钮宽度、动画 ID 等 UI 常量。
- `types.ts`：模块内共享的类型定义（`ImageSelectorProps`、`SourceMode`、`ModeButtonDescriptor` 等）。
- `utils.ts`：工具函数（自动旋转样式注入、来源解析、Layer 信息解析等）。
