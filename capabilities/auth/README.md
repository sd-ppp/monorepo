# @sdppp/auth

认证功能模块,提供 Supabase 会话管理。

从 taskrouter 项目迁移。

## 功能

- ✅ Supabase 会话管理 (通过 authing-bridge3 转换 token)
- ✅ 支持 UXP 和 Mainweb 平台
- ✅ 自动 token 刷新
- ✅ 单例模式

---

## 目录结构

```
capabilities/auth/
├── @mainweb/                # Supabase 会话管理 + Authing 登录
│   ├── supabase/
│   │   ├── config.ts       # 配置 (需要填入实际值)
│   │   ├── types.ts
│   │   ├── session.ts
│   │   └── advanced-session.ts
│   ├── authing/            # Mainweb Authing 登录
│   │   ├── AuthService.tsx
│   │   ├── AuthingCNService.ts
│   │   ├── authStore.ts
│   │   ├── phoneUtils.ts
│   │   └── components/
│   │       ├── Login.tsx
│   │       └── Login.less
│   └── index.ts            # 主导出
│
└── @uxp/                    # UXP 平台 - Authing 登录逻辑
    ├── index.ts
    ├── components/
    │   ├── BaseDialog.tsx
    │   ├── AuthingQRCode.tsx
    │   └── AuthingLoginDialog.tsx
    ├── ps-uxp-store-provider.ts
    └── src/
        └── SDPPPLoginProvider.ts
```

---

## 使用方式

### 1. 配置

首先编辑 `@mainweb/supabase/config.ts`,填入实际配置:

```typescript
export const SUPABASE_CONFIG = {
  url: 'https://your-project.supabase.co',        // 替换为实际 URL
  anonKey: 'your-anon-key-here',                  // 替换为实际 Key
  tenantId: 'your-tenant-id',                     // 替换为实际 Tenant ID
  bridgeFunctionName: 'authing-bridge3',
  bridgeRegion: 'ap-southeast-1',
} as const;
```

### 2. 在 UXP/Photoshop 插件中使用

```typescript
import { 
  initializeSupabase, 
  getSupabaseClient
} from '@sdppp/auth';

// 初始化 Supabase (用户登录后调用)
// 会自动从 mcpMesh.store.getState().token 获取 Authing token
await initializeSupabase();

// 获取 Supabase 客户端,用于其他查询
const client = getSupabaseClient();
const { data } = await client
  .from('some_table')
  .select('*')
  .eq('user_id', userId);

// 用户登出时清除会话
import { clearSupabase } from '@sdppp/auth';
clearSupabase();
```

### 3. 在 Mainweb 中使用

```typescript
import { 
  initializeSupabaseForMainweb,
  getSupabaseClient,
  AuthService,
  AuthingCNService
} from '@sdppp/auth';

// 从你的状态管理中获取 Authing token
const authingToken = yourStore.getState().authingToken;
const authingAppId = yourStore.getState().authingAppId;

// 初始化 Supabase (必须手动传入 token)
await initializeSupabaseForMainweb(authingToken);

// 初始化 Authing 登录服务
AuthService.setProvider(new AuthingCNService(authingAppId));

// 使用 Supabase 客户端查询其他数据
const client = getSupabaseClient();
const { data } = await client.from('users').select('*');
```

---

## API 文档

### Supabase 会话管理

#### `initializeSupabase(options?)`

初始化 Supabase 会话 (UXP 平台)

```typescript
interface SupabaseInitOptions {
  authingToken?: string;  // 可选,不传则从 mcpMesh 自动获取
  tenantId?: string;      // 可选,不传则使用配置中的默认值
}

await initializeSupabase();
// 或
await initializeSupabase({ 
  authingToken: 'manual-token',
  tenantId: 'custom-tenant' 
});
```

#### `initializeSupabaseForMainweb(authingToken, tenantId?)`

初始化 Supabase 会话 (Mainweb 平台)

```typescript
await initializeSupabaseForMainweb('your-authing-token');
// 或
await initializeSupabaseForMainweb('your-authing-token', 'custom-tenant');
```

#### `getSupabaseClient()`

获取当前的 Supabase 客户端

```typescript
const client = getSupabaseClient();
```

#### `getSupabaseSession()`

获取当前会话

```typescript
const session = getSupabaseSession(); // Session | null
```

#### `getSupabaseUserId()`

获取当前用户 ID

```typescript
const userId = getSupabaseUserId(); // string | null
```

#### `clearSupabase()`

清除 Supabase 会话

```typescript
clearSupabase();
```

#### `isSupabaseInitialized()`

检查是否已初始化

```typescript
if (isSupabaseInitialized()) {
  // 已初始化
}
```

---

## 工作原理

### 认证流程

1. 从 `mcpMesh.store.getState().token` 获取 Authing token (或手动传入)
2. 创建 Supabase 客户端 (此时未认证)
3. 调用 Supabase Edge Function `authing-bridge3`:
   ```typescript
   {
     token: authingToken,
     tenantId: tenantId,
     nonce: undefined
   }
   ```
4. `authing-bridge3` 返回 Supabase access_token 和 refresh_token
5. 使用返回的 token 设置 Supabase 会话:
   ```typescript
   await client.auth.setSession({
     access_token: data.access_token,
     refresh_token: data.refresh_token
   })
   ```
6. 现在 client 已认证,可以查询数据库
7. Supabase SDK 自动处理 token 刷新

## 注意事项

1. **必须先初始化** - 使用 `getSupabaseClient()` 前必须先调用 `initializeSupabase()`
2. **Token 有效性** - 确保 Authing token 有效,否则会初始化失败
3. **配置填写** - 必须在 `config.ts` 中填入实际的 Supabase URL、Key 和 Tenant ID
4. **平台差异**:
   - UXP: 自动从 `mcpMesh.store` 获取 token
   - Mainweb: 必须手动传入 token
5. **单例模式** - Supabase 客户端全局共享,多次调用 `initializeSupabase()` 会覆盖之前的实例

---

## 依赖

- `@supabase/supabase-js` - Supabase 客户端
- `@sdppp/mcp-mesh-photoshop` - MCP Mesh 状态管理 (仅 UXP)
- `@sdppp/ps-uxp` - UXP 插件系统
- `zod` - 类型校验

---

## 许可

与主项目相同
