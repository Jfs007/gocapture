# 从 Gitee 部署文档

GoCapture 文档使用 VitePress 构建，输出目录中的内容都是纯静态文件。

当前仓库地址：

```text
https://gitee.com/senruo/magnus
```

::: warning 当前 Gitee Pages 状态
Gitee 官方帮助中心目前已将个人版 Gitee Pages 和 Pages Pro 标记为“功能已下线”。如果你的仓库里仍有可用的 Pages 入口，可以继续使用下面的 Pages 方式；如果没有入口，需要通过 Gitee Go 部署到自己的服务器，或使用其他静态托管服务。
:::

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

## 4. 仓库仍有 Pages 权限

为 Gitee 仓库名 `/magnus/` 指定基础路径：

```bash
GOCAPTURE_DOCS_BASE=/magnus/ npm run docs:build
```

根据当前 Gitee Pages 的发布方式，将 `docs/.vitepress/dist` 中的全部文件发布为站点根目录。

如果使用单独的 Pages 分支，可以将构建产物提交到该分支，再在仓库的 Pages 设置中选择该分支。

预期访问地址：

```text
https://senruo.gitee.io/magnus/
```

## 5. 普通 Gitee 仓库

没有 Pages 入口时，建议让 Gitee 继续保存源码，然后将静态产物部署到自己的 Web 服务器：

```bash
GOCAPTURE_DOCS_BASE=/ npm run docs:build
```

把下面目录的全部内容上传到 Nginx、对象存储静态站点或其他静态托管服务：

```text
docs/.vitepress/dist
```

Nginx 最小配置：

```nginx
server {
  listen 80;
  server_name docs.example.com;
  root /var/www/gocapture-docs;
  index index.html;

  location / {
    try_files $uri $uri.html $uri/ =404;
  }
}
```

也可以使用 Gitee Go 构建文档，再把 `docs/.vitepress/dist` 发布到已接入的服务器。

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
