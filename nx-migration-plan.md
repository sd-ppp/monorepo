# SDPPP 项目 Nx 化改造计划

## 目标

将当前仓库从「`pnpm workspace` + 自定义脚本编排」升级为「`pnpm workspace` + `Nx` 项目图 / 任务图管理」。

本次改造目标：

- 使用 `nx graph` 管理主干项目依赖图。
- 使用 `Nx` 统一管理 `build` / `dev` / `test` / `lint` / `typecheck` 等任务。
- 用 `Nx` 逐步替代根目录的手写构建编排逻辑。
- 保留现有目录结构，不因为接入 `Nx` 而重排为 `apps/` / `libs/`。
- 避免引入大量临时性或过渡性配置文件。

## 约束与原则

- 不以“试运行”方式双轨并存，目标是直接切到 `Nx` 驱动。
- 不主动调整现有目录结构。
- 不默认把所有嵌套 `package.json` 都纳入主图。
- 不优先生成大量 `project.json`，优先复用现有 `package.json` 并在其中补 `nx` 配置。
- 不为了让图好看而临时隐藏真实依赖环。

## 当前实施状态

截至当前版本：

- 阶段 1 已完成
- 阶段 2 仅完成一小部分
- 阶段 3 的核心迁移已完成，但旧脚本尚未删除
- 阶段 4 尚未开始

粗略完成度判断：

- 阶段 1：100%
- 阶段 2：15%
- 阶段 3：85%
- 阶段 4：0%

整体大致处于“基础设施已切换到 `Nx`，后续治理未完成”的状态。

## 当前现状

### 当前 workspace 结构

根目录 `pnpm-workspace.yaml` 当前包含：

- `packages/*`
- `plan-packages/*`
- `internals/*`
- `release-repos/*`
- `capabilities/*`

### 当前根级构建入口

根目录 `package.json` 目前主要通过以下脚本驱动：

- `build`: `node build/build.js`
- `dev`: `cross-env NODE_ENV=development pnpm --filter '*' --filter '!.' --parallel dev`

其中 `build/build.js` 负责：

1. 先构建除 `packages/sdppp-photoshop` 和 `release-repos/sd-ppp` 之外的包
2. 单独构建 `packages/sdppp-photoshop`
3. 统一执行 `post_build`
4. 执行 `build/package-psccx.js`
5. 最后构建 `release-repos/sd-ppp`

### 当前仓库的几个结构性问题

#### 1. 项目脚本不统一

部分项目已有 `build` / `dev` / `test` / `lint`，部分项目完全没有脚本。

这意味着接入 `Nx` 后，第一版不可能依靠“自动推断”一次性得到完整任务图，需要补齐关键项目的最小 target。

#### 2. 存在 manifest 级循环依赖

当前已确认的依赖环包括：

- `@sdppp/auth <-> @sdppp/balance`
- `@sdppp/auth -> @sdppp/balance -> @sdppp/ps-uxp -> @sdppp/auth`
- `@sdppp/balance -> @sdppp/ps-uxp -> @sdppp/balance`
- `@sdppp/resourcing <-> @sdppp/mcp-mesh-photoshop`
- `@sdppp/resourcing -> @sdppp/ps-uxp -> @sdppp/resourcing`

这些环不会阻止 `Nx` 接入，但会降低 `affected` 和任务编排的治理价值。

#### 3. 存在嵌套应用

当前仓库至少有这些更深层嵌套项目：

- `packages/sdpppx-services/demo`
- `packages/sdppp-ui-library/playground`

这些项目如果直接纳入主图，会让第一版 `nx graph` 变得噪音较大。

#### 4. 存在不完整的 workspace 依赖

已发现：

- `packages/sdpppx-services/demo/package.json` 依赖了缺失的 workspace 包 `@sdppp/ppdraw`

这类问题会在 `Nx` 项目图和任务执行阶段更早暴露。

## 主图设计

第一版 `Nx` 主图采用“顶层业务包图”，而不是“全仓库任意 `package.json` 扫描图”。

### 主图纳入范围

主图纳入以下顶层 workspace 项目：

- `packages/*`
- `capabilities/*`
- `internals/*`
- `plan-packages/*`
- `release-repos/*`

### 第一版不纳入主图的嵌套项目

第一版不作为独立 `Nx` 项目纳入主图：

- `packages/sdpppx-services/demo`
- `packages/sdppp-ui-library/playground`

原因：

- 避免主图被 demo / playground 节点污染
- 先让主图承担“主干项目治理”职责
- 后续若 demo / playground 要进入 CI，再单独纳入

### 主图的主要层次

#### 1. 入口层

- `sdppp-photoshop`
- `sdppp`
- `comfy`
- `@sdppp/storybook`

#### 2. 能力层

- `@sdppp/auth`
- `@sdppp/balance`
- `@sdppp/resourcing`
- `@sdppp/sdpppx-services`
- `@sdppp/pptask`
- `@sdppp/task-router`

#### 3. UI 层

- `@sdppp/ui-library`
- `@sdppp/widgetable-ui`
- `@sdppp/formily-widgets`
- `@sdppp/formily-widgetable-adapter`
- `sdppp-photoshop-widgets`

#### 4. 基础设施层

- `@sdppp/common`
- `@sdppp/vite-remote-config-loader`
- `@sdppp/ps-uxp`
- `@sdppp/ps-uxp-sdk`
- `@sdppp/mcp-mesh`
- `@sdppp/mcp-mesh-photoshop`
- `@sdppp/mcp-postmessage-transport`
- `@sdppp/internal-common`
- `sdpppx-manifest`

#### 5. 工具层

- `@sdppp/cbm-calculator`
- `@sdppp/mock-photoshop`

## 改造策略

### 总体策略

采用“一次性切换到 `Nx` 驱动”的方式：

- 新增根级 `nx.json`
- 在根 `package.json` 中增加 `Nx` 命令入口
- 在必要项目的 `package.json` 中补 `nx` 配置
- 将根级构建流程迁移成 `Nx` pipeline
- 最终删除或废弃 `build/build.js`

### 不采用的策略

以下方案不采用：

- 不先创建一套临时桥接层再慢慢迁移
- 不先把目录重构成 `apps/` / `libs/`
- 不大规模创建 `project.json`
- 不把所有嵌套 `package.json` 全量扫描进 graph

## 计划中的配置落点

### 1. 根目录新增 `nx.json`

状态：已完成。

当前已包含：

- `namedInputs`
- `targetDefaults`
- `defaultBase`

用途：

- 统一输入输出约定
- 定义全局任务依赖关系
- 配置缓存行为

### 2. 根目录 `package.json`

状态：已完成。

已完成修改：

- 添加 `nx` 依赖
- 将根脚本切换为 `Nx` 驱动
- 增加项目图和受影响任务相关脚本

当前新增或调整的脚本：

- `build`
- `dev`
- `graph`
- `show:project`
- `affected:build`
- `affected:test`
- `affected:lint`
- `affected:typecheck`

### 3. 项目级配置优先写入 `package.json`

状态：部分完成。

对于已有 `package.json` 的项目，优先在其中补：

- `nx.targets`
- 必要时补 `scripts`

不优先创建独立 `project.json`。

当前实际情况：

- 根项目 `sdppp-mono` 已在根 `package.json` 中定义 `nx.targets`
- `@sdppp/vite-remote-config-loader` 已补 `typecheck` 脚本
- 其他关键项目尚未系统补齐，因为部分项目一旦补 `typecheck` 会立即暴露大量现存类型错误

## 任务模型设计

### 第一版统一管理的 target

状态：部分完成。

第一版目标是先统一这几个 target：

- `build`
- `dev`
- `test`
- `lint`
- `typecheck`

### `targetDefaults` 设计原则

状态：已完成。

当前已在 `nx.json` 中统一定义：

- `build` 默认依赖上游项目的 `build`
- `test` 使用共享输入并启用缓存
- `lint` 默认不强依赖上游构建
- `typecheck` 使用共享输入并启用缓存
- `dev` 不启用缓存

### 输出与缓存

状态：已部分落实。

第一版只对明确产物目录的项目配置缓存输出，比如：

- `dist`
- `storybook-static`
- 打包产物目录

对于仅运行开发服务器或无稳定输出的项目，不强行配置 outputs。

当前实际做法：

- 主要通过 `namedInputs` 和 `targetDefaults` 控制缓存
- 暂未为每个项目逐一精细声明 outputs
- `dev` 与根级 orchestration target 已显式关闭缓存

## 根构建链替换方案

### 当前问题

当前根级构建依赖 `build/build.js` 手写顺序控制。

这会带来几个问题：

- 顺序逻辑散落在脚本里，不在项目图里表达
- 无法直接复用 `Nx affected`
- 任务依赖关系不可视化
- 缓存和增量构建收益有限

### 替换目标

状态：核心已完成。

将当前构建链改写为显式 `Nx` 任务依赖：

1. 通用项目构建
2. `sdppp-photoshop` 构建
3. `post_build` 阶段
4. `package-psccx` 阶段
5. `release-repos/sd-ppp` 构建

### 迁移方式

当前进度：

第一步：

- 已完成，在根 `package.json` 中定义了等价的 orchestration target

第二步：

- 已完成，已成功运行一次完整 `pnpm build`

第三步：

- 未完成，`build/build.js` 仍保留在仓库中，当前只是失去主入口地位

## 项目补齐策略

### 第一批需要优先补齐 target 的项目

状态：仅开始。

以下项目当前缺少足够的标准任务入口，建议优先补齐：

- `@sdppp/common`
- `@sdppp/formily-widgetable-adapter`
- `@sdppp/formily-widgets`
- `sdppp-photoshop-widgets`
- `@sdppp/vite-remote-config-loader`
- `@sdppp/auth`
- `@sdppp/balance`
- `@sdppp/internal-common`

### 补齐原则

当前执行情况：

- 能直接用 `tsc --noEmit` 的，先补 `typecheck`
- 有稳定构建过程的，再补 `build`
- 有测试的项目补 `test`
- 没有统一 lint 体系的项目不强行补 `lint`

目前仅有：

- `@sdppp/vite-remote-config-loader` 补了 `typecheck`

已验证但暂未纳入默认 target 的情况：

- `@sdppp/auth`
- `@sdppp/balance`
- `@sdppp/formily-widgets`

这些项目一旦直接补 `typecheck`，会暴露大量现存类型错误，因此暂不作为第一版默认完成项。

### 暂不强推的事情

以下内容不应与第一版 Nx 接入绑死：

- 全仓统一 ESLint 配置
- 全仓统一测试框架版本
- 全仓统一 Vite 版本
- 全量拆分循环依赖

这些是后续治理项，不是接入阻塞项。

## 循环依赖治理计划

### 原则

状态：已执行。

第一版不为接入 `Nx` 而临时掩盖循环依赖。

图里应保留真实依赖关系，后续再治理。

### 建议优先处理的环

#### 1. `@sdppp/auth <-> @sdppp/balance`

建议思路：

- 提取共享 contract / store / type 层
- 将双向依赖变为共同依赖基础包

#### 2. `@sdppp/resourcing <-> @sdppp/mcp-mesh-photoshop`

建议思路：

- 将 mesh 描述与资源操作实现分层
- 避免资源层反向依赖协议层

#### 3. `@sdppp/ps-uxp` 与 capability 的互相牵连

建议思路：

- 将 runtime 接口与业务能力拆成更明确的边界
- 降低 `ps-uxp` 成为“全能中枢节点”的程度

## 分阶段实施计划

### 阶段 1：接入 Nx 并建立主图

状态：已完成。

目标：

- 接入 `Nx`
- 能运行 `nx graph`
- 能运行基础任务

主要动作：

1. 安装 `nx`
2. 新增根 `nx.json`
3. 修改根 `package.json`
4. 确认顶层 workspace 项目能被识别
5. 验证 `nx graph` 输出符合主图预期

交付结果：

- 可以看到主干依赖图
- 可以在根目录用 `Nx` 发起任务

实际结果：

- 已接入 `Nx`
- 已能运行 `nx graph` / `nx show project`
- 已通过 `.nxignore` 将 `internals/*` 纳入主图
- 已排除 `storybook-static` 这类产物目录

### 阶段 2：补齐关键项目任务

状态：部分完成。

目标：

- 让关键项目具备可统一调度的 `build` / `test` / `typecheck`

主要动作：

1. 为缺少脚本的项目补 `scripts` 或 `nx.targets`
2. 明确关键项目的输入输出
3. 校准 `targetDefaults`

交付结果：

- `run-many` 和 `affected` 对关键项目可用

实际结果：

- `run-many` 与 `affected` 已可用于已有标准脚本的项目
- 对缺失标准脚本的关键项目，仅完成极少量补齐
- 该阶段的主体工作仍待继续

### 阶段 3：迁移根构建链

状态：核心已完成。

目标：

- 用 `Nx` pipeline 接管根构建

主要动作：

1. 将 `build/build.js` 的步骤迁移到 `Nx`
2. 验证构建顺序和产物一致
3. 删除或停用旧脚本

交付结果：

- 根构建由 `Nx` 统一编排

实际结果：

- 根 `build` 已切换到 `nx run sdppp-mono:workspace-build`
- 原 `build/build.js` 的主要步骤已迁入 `Nx` target pipeline
- 完整构建已成功跑通，包括 plugin 目录与 `.ccx` 打包
- 旧脚本文件尚未删除

### 阶段 4：图治理与 CI 落地

状态：未开始。

目标：

- 提升 `affected` 价值
- 将 `Nx` 引入 CI

主要动作：

1. 逐步拆除关键循环依赖
2. 将 CI 切换为 `nx affected`
3. 根据需要再纳入 demo / playground

交付结果：

- 主图更稳定
- CI 增量执行生效

## 风险与应对

### 风险 1：接入后图中暴露大量环

说明：

- 这是结构真实状态，不是 `Nx` 引入的问题

应对：

- 接受第一版图存在环
- 后续按优先级治理

### 风险 2：部分项目没有标准 target

说明：

- 会导致 `run-many` 或 `affected` 覆盖不全

应对：

- 分批补齐关键项目
- 不要求第一版全仓一步到位

### 风险 3：根构建链迁移时产物顺序变化

说明：

- 当前脚本里存在显式先后顺序

应对：

- 在迁移阶段对比旧构建和新构建产物
- 通过 `dependsOn` 显式表达顺序

### 风险 4：嵌套应用未入主图导致增量收益不完整

说明：

- demo / playground 不会作为独立项目参与 `affected`

应对：

- 第一版接受这个取舍
- 后续按 CI 需要单独纳入

## 验收标准

完成第一版 Nx 化后，应满足以下条件：

1. 根目录可直接执行 `nx graph`
2. 主图只包含顶层主干项目，不包含 demo / playground 等嵌套应用
3. 根目录可执行统一的 `build` / `dev` / `affected:*` 脚本
4. 主图能真实展示当前循环依赖，不做人为隐藏
5. `build/build.js` 的迁移路径明确，且不再是长期主入口

当前验收状态：

- 1 已满足
- 2 已满足
- 3 已满足
- 4 已满足
- 5 部分满足

说明：

- 迁移路径已明确，主入口也已切到 `Nx`
- 但 `build/build.js` 文件还未删除，仓库中仍保留旧实现

## 后续建议

在 `Nx` 接入完成后，建议按以下优先级继续治理：

1. 先拆 `auth` / `balance` 环
2. 再拆 `resourcing` / `mcp-mesh-photoshop` 环
3. 再评估 `ps-uxp` 是否应该拆成更细的 runtime / adapter / plugin 层
4. 最后根据 CI 需要，把 `demo` 和 `playground` 作为独立项目纳入

## 本计划的结论

本项目的 `Nx` 化不需要调整目录结构。

合理的实施方式是：

- 保留现有 `pnpm workspace` 布局
- 新增最少量 `Nx` 配置
- 将主图收敛为顶层业务包图
- 逐步把根级手写编排迁移为 `Nx` 任务依赖
- 后续再处理循环依赖与嵌套应用纳入问题
