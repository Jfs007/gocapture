# 部署到 GitHub Pages

GoCapture 使用 GitHub Actions 自动构建并发布文档。

源码仓库：

```text
https://github.com/Jfs007/gocapture
```

文档地址：

```text
https://jfs007.github.io/gocapture/
```

## 自动部署

工作流位于：

```text
.github/workflows/docs-pages.yml
```

每次向 GitHub 的 `main` 分支推送代码时，工作流会：

1. 安装 Node.js 与项目依赖
2. 执行 `npm run docs:build`
3. 上传 `docs/.vitepress/dist`
4. 发布到 GitHub Pages

也可以在 GitHub 仓库的 **Actions** 页面手动运行。

## 首次启用

进入仓库：

```text
Settings → Pages
```

在 **Build and deployment** 中将 **Source** 设置为：

```text
GitHub Actions
```

首次工作流成功后，GitHub 会显示正式访问地址。

## 本地预览

```bash
npm install
npm run docs:dev
```

## 本地生产构建

```bash
npm run docs:build
```

默认生产基础路径是：

```text
/gocapture/
```

构建结果位于：

```text
docs/.vitepress/dist
```

如果未来配置自定义域名，改用根路径构建：

```bash
GOCAPTURE_DOCS_BASE=/ npm run docs:build
```
