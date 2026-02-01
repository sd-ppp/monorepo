# @sdppp/auth

认证功能模块,提供 Supabase 会话管理。

从 taskrouter 项目迁移。

## 功能

- ✅ Supabase 会话管理 (通过 authing-bridge3 转换 token)
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
│   │   └── sdppp-sb-session.ts
│   ├── authing/            # Mainweb Authing 登录
│   │   ├── AuthService.tsx
│   │   ├── AuthingCNService.ts
│   │   ├── authStore.ts
│   │   ├── phoneUtils.ts
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

### 2. 在 SDPPPSB 环境中使用

```typescript
import {
  initializeSupabaseFromSDPPPSB,
  getSupabaseClientFromSDPPPSB,
  clearSupabaseFromSDPPPSB,
} from '@sdppp/auth';

// 初始化 Supabase (用户登录后调用)
await initializeSupabaseFromSDPPPSB();

// 获取 Supabase 客户端,用于其他查询
const client = getSupabaseClientFromSDPPPSB();
const { data } = await client
  .from('some_table')
  .select('*')
  .eq('user_id', userId);

// 用户登出时清除会话
clearSupabaseFromSDPPPSB();
```

---

## API 文档

### Supabase 会话管理

#### `initializeSupabaseFromSDPPPSB()`

初始化 Supabase 会话 (SDPPPSB 环境)

```typescript
await initializeSupabaseFromSDPPPSB();
```

#### `getSupabaseClientFromSDPPPSB()`

获取当前的 Supabase 客户端

```typescript
const client = getSupabaseClientFromSDPPPSB();
```

#### `clearSupabaseFromSDPPPSB()`

清除 Supabase 会话

```typescript
clearSupabaseFromSDPPPSB();
```

---

---

## 依赖

- `@supabase/supabase-js` - Supabase 客户端
- `@sdppp/ps-uxp` - UXP 插件系统
- `zod` - 类型校验

---

## 许可

与主项目相同
