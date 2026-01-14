# 线索采集器使用说明

## 项目结构

```
src/
├── components/
│   ├── LoginPage.vue      # 登录页面组件
│   └── MainLayout.vue     # 主布局组件（包含Tab）
├── config/
│   └── env.ts            # 环境配置
├── hooks/
│   └── useLogin.ts       # 登录逻辑Hook
├── types/
│   ├── mdChrome.d.ts     # Chrome扩展类型定义
│   └── chromeRedux.d.ts  # ChromeRedux类型定义
└── App.vue               # 应用入口
```

## 功能说明

### 1. 权限系统

基于 token 的权限验证系统：

- **自动检查**：应用启动时自动检查 token 是否存在
- **token 失效处理**：当 API 返回 401 或 token 相关错误时，自动退出登录
- **登录跳转**：未登录时自动打开新窗口跳转到登录页面

### 2. 环境配置

支持三种环境，通过 URL 参数 `?env=xxx` 指定：

| 环境 | URL 参数 | 登录地址 |
|------|---------|---------|
| 本地 | `?env=local` | http://localhost:9002 |
| 测试 | `?env=test` | https://testad.itaored.com |
| 生产 | `?env=prod` | https://ad.itaored.com |

### 3. 主界面

登录后显示主界面，包含：

- **标题**：线索采集器
- **环境标签**：显示当前环境
- **用户信息**：显示用户名
- **退出按钮**：点击退出登录并跳转到登录页面

### 4. Tab 功能

两个功能 Tab：

1. **1688厂家收集**：用于收集1688平台的厂家信息
2. **抖音商家收集**：用于收集抖音平台的商家信息

## 使用方式

### 在组件中使用 useLogin

```typescript
import { useLogin } from '../hooks/useLogin'

const { 
  userInfo,      // 用户信息
  isLoggedIn,    // 是否已登录
  isLoading,     // 是否加载中
  logOut,        // 退出登录
  checkAuth,     // 检查认证
  handleApiError // 处理API错误
} = useLogin()

// 检查认证
await checkAuth()

// 处理API错误（自动处理token失效）
try {
  // API 调用
} catch (error) {
  handleApiError(error)
}

// 手动退出
logOut()
```


## 认证流程

```
1. 应用启动
   ↓
2. 显示 Loading
   ↓
3. checkAuth() 检查 token
   ↓
4. token 存在？
   ├─ 是 → 显示 MainLayout
   └─ 否 → 显示 LoginPage + 打开登录窗口
```

## API 错误处理

当接口返回 401 或 token 相关错误时：

```typescript
handleApiError(error)
// 自动执行：
// 1. 清空 userInfo
// 2. 设置 isLoggedIn = false
// 3. 打开登录窗口
```

## 类型定义

### UserInfo

```typescript
interface UserInfo {
  token?: string
  username?: string
  userId?: string
  [key: string]: any
}
```

### EnvConfig

```typescript
interface EnvConfig {
  apiUrl: string
  name: string
}
```

## 注意事项

1. **token 获取**：通过 Chrome 插件的 chromeRedux 模块获取共享的 token
2. **登录方式**：不在当前页面登录，而是打开新窗口进行登录
3. **环境切换**：通过 URL 参数控制，无需修改代码
4. **组件化设计**：登录逻辑和 UI 完全分离，便于维护
