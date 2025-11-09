# SDPPP Task Router

通过 `url + data` 的方式触发并运行 AI 任务，统一分发到不同 Provider（RunningHub、Replicate、CustomAPI、Comfy 等）的客户端，实现“发起请求（业务）”与“UI（表单/呈现）”的彻底解耦。

## 设计目标

- 以统一入口 `run(url, data, options)` 触发任务，内部按 URL scheme 路由到具体 Provider。
- 返回现有 `Task` 对象（兼容进度、取消、错误处理等语义）。
- 支持注册/扩展：可为任意新 Provider 注册自定义 handler。
- 支持将配置（apiKey、baseURL 等）通过 URL 或外部上下文注入。

## URL 规范（建议）

- RunningHub：`runninghub://{webappId}`
  - data：优先支持直接传 `nodeInfoList`；若未提供，可传普通键值对（由 RunningHub 客户端合并）。
- Replicate：`replicate://{owner}/{model}[?version=xxx]`
  - data：模型输入（如 prompt、width/height、images 等）。
- CustomAPI：`customapi://{format}`，其中 `{format} ∈ {google|openai}`；可附 `?baseURL=...`
  - data：至少包含 `prompt` 与 `image_input`（token 或 dataURL）。
- Comfy（预留）：`comfy://{workflowId}`
  - data：workflow 运行所需的输入参数。

说明：必要配置既可放在 URL 的 query，也可通过 `options.config` 传入，或由外部“配置提供者”注入。

## 核心 API（草案）

```ts
interface RunOptions {
  signal?: AbortSignal;
  // 用于为 handler 构造 Client 的必要配置（如 apiKey、baseURL）
  config?: Record<string, any>;
  // 可选：任务上报/埋点接口（不提供时直接使用 Task 默认行为）
  reporter?: {
    onStart?: (taskId: string, meta?: any) => void;
    onProgress?: (taskId: string, progress: number, message?: string) => void;
    onFinish?: (taskId: string, status: 'completed' | 'failed' | 'cancelled', error?: string) => void;
  };
}

// 统一入口：解析 URL → 匹配 handler → 构造 client → client.run(...)
function run(url: string, data: Record<string, any>, options?: RunOptions): Promise<Task<any>>

// 注册与扩展：为 scheme 绑定 handler
function register(
  scheme: string,
  handler: (url: URL, data: any, ctx: { options?: RunOptions }) => Promise<Task<any>>
): void

// 获取表单结构（各 provider 的 getNodes 聚合）
function describe(url: string, options?: RunOptions): Promise<{
  widgetableNodes: any[];
  defaultInput: Record<string, any>;
  rawData: any;
}>

// 统一上传接口（各 provider 的 uploadImage 聚合）
type UploadInput = { type: 'token' | 'buffer' | 'resource'; image: ArrayBuffer | string; format: 'png' | 'jpg' | 'jpeg' | 'webp' };
function upload(url: string, input: UploadInput, options?: RunOptions): Promise<string>

// 取消任务（若任务可取消）
function cancel(task: Task): Promise<void>
```

> 注：`Task` 类型沿用现有实现（进度、取消、resultGetter/statusGetter 语义保持一致）。

## 使用示例

- Replicate

```ts
const url = 'replicate://black-forest-labs/flux-1.1-pro';
const data = { prompt: 'a cat', width: 768, height: 768, num_outputs: 1 };
const task = await UrlTaskRunner.run(url, data, { config: { apiKey: '...' } });
const outputs = await task.promise; // [{ url, rawData }, ...]
```

- RunningHub（优先 nodeInfoList 直通）

```ts
const url = 'runninghub://flux-kontext-pro';
const data = { nodeInfoList: [...] };
const task = await UrlTaskRunner.run(url, data, { config: { apiKey: '...' } });
```

- CustomAPI（Google/OpenAI）

```ts
const url = 'customapi://google?baseURL=https://...';
const data = { prompt: '...', image_input: 'data:image/png;base64,...' };
 await TaskRouter.run(url, data, { config: { apiKey: '...' } });
```

### 获取表单结构（describe）

```ts
await TaskRouter.describe('replicate://black-forest-labs/flux-1.1-pro', { config: { apiKey: '...' } });
await TaskRouter.describe('runninghub://my-webapp', { config: { apiKey: '...' } });
await TaskRouter.describe('customapi://google?baseURL=https://...', { config: { apiKey: '...' } });
```

### 上传资源（upload）

```ts
await TaskRouter.upload('replicate://black-forest-labs/flux-1.1-pro', {
  type: 'buffer',
  image: someArrayBuffer,
  format: 'png'
}, { config: { apiKey: '...' } });
```

### 取消任务（cancel）

```ts
const task = await TaskRouter.run('replicate://owner/model', {...}, { config: { apiKey: '...' } });
await TaskRouter.cancel(task); // 若该任务支持取消
```

## 与现有 Provider 的对接

- 复用已有客户端：
  - Replicate 客户端（`SDPPPReplicate`）可直接通过 `client.run(model, data)` 适配。
  - CustomAPI 客户端（`SDPPPCustomAPI`）同理；`format`、`baseURL` 从 URL/配置注入。
  - RunningHub 客户端（`SDPPPRunningHub`）建议补充“`input.nodeInfoList` 直通发起”的旁路（若存在则跳过 UI store 合并），从而 URL 触发无需依赖 UI 状态。
  - Comfy：若已有前端 client，同步提供 handler；若尚未完成，可先预留。

- UI 解耦方式：Provider 的 Renderer 只负责把表单值组装成 `url + data`，调用 `UrlTaskRunner.run()`；`useTaskExecutor` 也可以直接使用该入口。

## 错误处理与取消

- 取消：透传 `AbortSignal` 到具体 client 的 `run(...)` 和内部轮询请求。
- 错误：保持各 client 的错误信息与 HTTP 状态透出；UrlTaskRunner 负责标准化常见解析/路由错误（如不支持的 scheme、URL 参数缺失等）。

## 扩展点

- 自定义注册：`register('myprovider', handler)` 即可扩展新协议。
- 配置注入：支持从 `options.config`、URL query、或外部“配置提供者”统一获取（推荐支持优先级：options.config > URL query > 默认值）。
- 任务上报：可选的 `reporter` 接口便于将 Task 的生命周期上报到宿主（如 Photoshop 面板），但该模块本身不强绑定宿主。

## Roadmap

- [ ] 初始实现：解析器 + 注册表 + 3 个内置 handler（runninghub/replicate/customapi）。
- [ ] RunningHub client 增加 `nodeInfoList` 直通通道（向后兼容）。
- [ ] 可选 reporter 注入，解耦 Task 与宿主上报逻辑。
- [ ] Comfy handler 对接。
- [ ] 完善类型定义与 e2e 示例。

---

本 README 仅为设计与使用说明，落地实现将遵循此接口并与现有 Provider 客户端保持兼容。

## 迁移计划

分阶段将现有 Provider 的“发起请求逻辑”迁移到 URL Task Runner，最小化对 UI 的影响，并保持功能等价。

1) 启动阶段（新增而不改动现有逻辑）
- 引入 `sdppp-url-task-runner` 包与基础骨架：解析器、注册表、`run()` API。
- 内置 handler 草拟：runninghub、replicate、customapi（comfy 预留）。
- 不修改现有 Provider 渲染器与客户端，先完成模块自测。

2) RunningHub 客户端补强（向后兼容）
- 在 `SDPPPRunningHub.run(webappId, input, signal)` 内增加分支：当 `input.nodeInfoList` 存在时，直接用该列表发起请求（跳过 UI store 合并）。
- 保留旧逻辑作为 fallback，确保不破坏当前使用路径。

3) 编写内置 handlers（功能对齐）
- Replicate handler：解析 `replicate://{owner}/{model}[?version=xxx]`，从 options.config/urlQuery 读取 `apiKey`，构造 `SDPPPReplicate` 并 `run(model, data)`。
- RunningHub handler：解析 `runninghub://{webappId}`，优先读取 `data.nodeInfoList`，从 options.config 读取 `apiKey`，调用 `SDPPPRunningHub.run(webappId, data)`。
- CustomAPI handler：解析 `customapi://{format}?baseURL=...`，读取 `apiKey`，构造 `SDPPPCustomAPI` 并 `run(format, data)`。
- Comfy handler：若现有前端 client 可直连则按同样模式实现；若未完备，保留占位与类型。

4) Provider 渲染层无感迁移（逐个 Provider）
- 在各 Provider 的渲染器中，组装 `url + data`，用 `UrlTaskRunner.run(url, data, { config })` 替换直接 `client.run(...)` 的调用。
- `useTaskExecutor` 可保持不变（仍接受 `createTask`），或新增一条通过 URL Runner 的分支（即 `createTask` 内部改为组装 url 并转发）。
- 验证生成、进度、取消、错误提示与预览导入闭环无差异。

5) 配置读取与优先级
- 统一封装配置解析：`options.config > URL query > 旧有全局存储/环境默认`。
- 在 Provider 渲染器中尽量不关心配置来源，仅传递必要 config。

6) 任务上报与解耦（可选增强）
- 若需要彻底解耦 `Task` 与宿主（如 Photoshop 任务面板），可引入可选 `reporter`，由 UrlTaskRunner 传给 client/Task。
- 过渡期可不改动 Task：保留现有 Photoshop 上报逻辑，待 reporter 完成后平滑切换。

7) 清理与文档
- Provider 内部不再保留“直接发起请求”的重复代码路径；只保留 url 组装与调用 UrlTaskRunner 的入口。
- 更新开发文档：URL 协议、data 约定、配置注入、错误/取消处理方式。

验收清单
- [ ] Replicate/RunningHub/CustomAPI 通过 UrlTaskRunner 跑通，结果一致。
- [ ] 取消/错误路径与现有行为一致（不丢日志、不丢错误信息）。
- [ ] 无 UI 断裂：表单到任务、任务到预览、导入/保存链路可用。
- [ ] 旧逻辑可随时回退（保留开关或分支）。

回滚策略
- 每个 Provider 改造时保留 feature flag（或环境变量）控制走旧路径或 UrlTaskRunner，新旧并存一段时间。
- 如出现兼容性问题，可快速切回旧逻辑，不影响用户侧操作。
