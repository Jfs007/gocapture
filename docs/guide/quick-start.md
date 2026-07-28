# 快速上手

本页从零开始安装 GoCapture，并完成第一次页面选区开发任务。

## 环境要求

- Node.js `20.18.1` 或更高版本
- Chrome 或 Chromium 浏览器
- 至少安装一个开发 Agent：
  - Codex
  - Claude Code

::: tip 系统支持
macOS 可以把 GoCapture 注册为登录自启的常驻服务。其他系统目前使用前台启动模式。
:::

## 1. 安装 CLI

```bash
npm install -g @sep-agent/gocapture
```

确认安装成功：

```bash
gocapture -v
```

## 2. 启动本地服务

### macOS：推荐常驻运行

```bash
gocapture install
```

该命令会注册用户级 LaunchAgent，支持登录自启、崩溃自愈和更新后重启。

查看状态：

```bash
gocapture status
```

健康检查应显示“在线”，默认地址为：

```text
http://127.0.0.1:17321
```

### 其他系统：前台运行

```bash
gocapture start
```

保持终端窗口运行。按 `Ctrl+C` 可以停止。

## 3. 加载 Chrome 扩展

执行：

```bash
gocapture chrome
```

GoCapture 会打开扩展目录并在终端显示目录路径。然后：

1. 在 Chrome 打开 `chrome://extensions`
2. 开启右上角的“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择 `gocapture chrome` 打开的目录
5. 将 GoCapture 固定到浏览器工具栏

## 4. 绑定源码项目

1. 打开需要修改的业务页面
2. 打开 GoCapture 侧边栏
3. 按启动引导选择“绑定项目”
4. 选择该页面对应的本地源码根目录

GoCapture 会保存页面地址与源码项目之间的关系。同一个域名的其他页面可以继续使用该项目。

## 5. 关联开发 Agent

在启动引导中选择一个可用 Agent：

- **Codex**：检查本机 Codex，并选择或创建项目任务
- **Claude Code**：检查本机 Claude Code，首次任务时建立项目会话

Agent 选择、任务 ID 与消息记录会保存在项目的 `.gocapture` 目录中，重启服务后仍可恢复。

## 6. 完成第一个任务

1. 在网页中框选需要修改的区域
2. 确认选区
3. 在输入框中描述需求，例如：

```text
@选区 把登录按钮的文案加粗
```

4. 提交任务

GoCapture 会把当前选区和需求交给开发 Agent。侧边栏会按时间顺序展示任务输入、执行过程和最终结果。

## 7. 继续修改同一个选区

选区会保存为稳定引用。下一轮可以直接说：

```text
@选区 再把文字颜色改成绿色
```

Agent 可以读取该选区的项目级位置记录，不需要再次接收整段 DOM，也不需要你重新描述页面位置。

## 常用命令

```bash
# 查看版本
gocapture -v

# 查看服务状态和日志路径
gocapture status

# 重启服务
gocapture restart

# 打开 Chrome 扩展目录
gocapture chrome

# 停止服务
gocapture stop

# 移除常驻服务
gocapture uninstall
```

## 遇到问题

### 侧边栏无法连接

先执行：

```bash
gocapture status
```

如果服务离线：

```bash
gocapture restart
```

未安装常驻服务时使用：

```bash
gocapture start
```

### 端口被占用

默认端口是 `17321`。可以临时指定其他端口：

```bash
gocapture start --port 17331
```

同时需要确保 Chrome 扩展使用相同的本地服务地址。

### 检测不到开发 Agent

确认对应 CLI 已安装并能在当前终端直接运行。GoCapture 本地服务必须能从 `PATH` 中找到该命令。
