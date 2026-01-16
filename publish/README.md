# LDD Pro 发布工具

用于将 main-site 的 dist 文件上传到火山引擎 TOS 对象存储。

## 安装依赖

```bash
cd publish
npm install
```

## 使用方法

### 1. 构建项目

首先需要构建 main-site 项目：

```bash
cd ../main-site
yarn build
```

### 2. 发布到开发环境

```bash
cd ../publish
npm run publish:dev
```

发布到：`itaomall-ad` bucket 的 `/dev/ad/` 目录

访问地址：https://ad-cdn.itaored.com/dev/ad/index.html

### 3. 发布到生产环境

```bash
npm run publish:prod
```

发布到：`itaomall-ad` bucket 的 `/prod/ad/` 目录

访问地址：https://ad-cdn.itaored.com/prod/ad/index.html

## 配置说明

### TOS 配置

- **Bucket**: `itaomall-ad`
- **Region**: `cn-beijing`
- **Endpoint**: `tos-cn-beijing.volces.com`

### 环境配置

| 环境 | 上传路径 | API 地址 |
|------|---------|---------|
| dev  | `/dev/ad/` | https://testad.itaored.com |
| prod | `/prod/ad/` | https://ad.itaored.com |

### STS Token

通过 API 接口动态获取临时凭证：

```
GET /api/dy/project/sts/token
```

返回格式：
```json
{
  "data": {
    "credentials": {
      "accessKeyId": "xxx",
      "secretAccessKey": "xxx",
      "sessionToken": "xxx",
      "expiredTime": "2026-01-16T12:00:00Z"
    }
  }
}
```

## 文件上传

- 自动识别文件类型并设置正确的 Content-Type
- 支持的文件类型：HTML, CSS, JS, JSON, 图片, 字体等
- 保持原有目录结构

## 注意事项

1. 确保已经构建了 main-site 项目（存在 dist 目录）
2. 确保有访问 API 的权限（获取 STS Token）
3. 上传前会自动获取临时凭证，无需手动配置密钥
4. 生产环境发布请谨慎操作

## 故障排查

### dist 目录不存在

```bash
cd ../main-site
yarn build
```

### STS Token 获取失败

检查 API 地址是否正确，网络是否通畅。

### 上传失败

检查 bucket 名称、region、endpoint 配置是否正确。
