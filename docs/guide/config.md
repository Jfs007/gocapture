# 项目与 Agent 配置

配置页默认地址：

```text
http://127.0.0.1:17321/settings
```

设置按项目保存。切换项目后，GoCapture 会读取对应项目的 Agent、Locator 和选区资产。

## 开发 Agent

开发 Agent 是 GoCapture 的主要执行者，负责理解项目、修改代码并验证结果。

### Codex

GoCapture 通过 Codex App Server 建立项目任务：

- 可以选择已有项目任务
- 可以创建新的项目任务
- 保存 Thread ID，后续需求继续使用同一任务
- 执行日志和结果回传到 GoCapture 时间线

### Claude Code

Claude Code 支持三种模型来源：

| 来源 | 含义 | 适合场景 |
| --- | --- | --- |
| 沿用 Claude Code | 不覆盖模型和密钥，读取 Claude Code 自己的用户或项目配置 | 本机已经配置完成 |
| Anthropic | GoCapture 启动的 Claude Code 使用官方 Anthropic API | 直接使用 Claude 官方模型 |
| 兼容模型后端 | Claude Code 保留 Agent 工作流，模型请求交给兼容 Anthropic Messages 协议的服务 | 使用 DeepSeek 等兼容服务 |

模型后端配置只影响 GoCapture 启动的 Claude Code，不修改本机 Claude Code 的全局设置。

## 项目网络代理

可以为当前项目设置公共代理，例如：

```text
http://127.0.0.1:7890
```

代理会应用于 GoCapture 为该项目启动的开发 Agent。设置保存在项目内，不影响其他项目。

## Locator

Locator 是可选的前置定位职责。

### 不配置 Locator

开发 Agent 接收经过压缩的页面选区事实，自行定位源码并完成修改。这是默认推荐模式。

### 配置 Locator

Locator 使用单独模型先完成源码定位，再把精确位置交给开发 Agent。

适用于：

- 主 Agent Token 成本较高
- 项目较大，页面定位通常需要多轮检索
- 希望将定位和开发职责分开观察

Locator 不负责修改代码，只提供经过验证的位置事实。

## 项目数据

项目运行数据保存在源码根目录的 `.gocapture` 中，主要包括：

```text
.gocapture/
  connect-agent.json           # 当前 Agent 与项目设置
  connect-agent-sessions.json  # 项目 Agent 任务
  selections/                  # 选区与源码位置
  message/                     # 时间线消息
```

不要把包含密钥或本机路径的文件提交到公共仓库。建议根据团队需要配置 `.gitignore`。

## 页面与项目绑定

GoCapture 先从用户级注册表中根据页面 URL 找到项目，再读取该项目的 `.gocapture` 数据。

一个项目可以绑定多个入口，例如：

```text
https://app.example.com/  → /Users/me/projects/web-console
http://localhost:9003/    → /Users/me/projects/web-console
```

这样线上页面与本地开发页面可以复用同一个源码项目和 Agent 任务。
