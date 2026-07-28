# 部署到 Gitee Pages

GoCapture 文档使用 VitePress 构建，输出目录中的内容都是纯静态文件。

当前仓库地址：

```text
https://gitee.com/senruo/magnus
```

默认生产构建路径已经适配仓库名 `/magnus/`。

## 1. 安装依赖

```bash
npm install
```

## 2. 本地预览

```bash
npm run docs:dev
```

开发地址通常是：

```text
http://localhost:5173
```

## 3. 构建静态页面

```bash
npm run docs:build
```

构建产物位于：

```text
docs/.vitepress/dist
```

## 4. 发布到 Gitee Pages

根据当前 Gitee Pages 的发布方式，将 `docs/.vitepress/dist` 中的全部文件发布为站点根目录。

如果使用单独的 Pages 分支，可以将构建产物提交到该分支，再在仓库的 Pages 设置中选择该分支。

## 自定义访问路径

默认生产路径是：

```text
/magnus/
```

如果使用自定义域名或发布到站点根目录，构建时覆盖：

```bash
GOCAPTURE_DOCS_BASE=/ npm run docs:build
```

如果仓库名发生变化：

```bash
GOCAPTURE_DOCS_BASE=/new-repo-name/ npm run docs:build
```

路径必须以 `/` 开头和结尾。
