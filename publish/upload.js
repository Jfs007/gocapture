import {TosClient} from '@volcengine/tos-sdk';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const config = {
  accessKeyId: '',
  accessKeySecret: '',
  stsToken: '',
  region: 'cn-beijing',
  bucket: 'itaomall-ad',
  endpoint: 'tos-cn-beijing.volces.com',
  expired: 0,
};

// 环境配置
const envConfig = {
  prod: {
    uploadPath: 'prod/ad/',
    apiUrl: 'https://ad.itaored.com'
  },
  dev: {
    uploadPath: 'dev/ad/',
    apiUrl: 'https://testad.itaored.com'
  }
};

// 获取 STS Token
async function getStsToken(apiUrl) {
  try {
    const response = await axios.get(`${apiUrl}/api/dy/project/sts/token`, {
      headers: {
        'accessToken': `7282a6e6985d91ac2c880ede23e12729`
      }
    });
    const credentials = response.data?.data?.credentials || {};
    
    config.accessKeyId = credentials.accessKeyId;
    config.accessKeySecret = credentials.secretAccessKey;
    config.stsToken = credentials.sessionToken;
    
    const isoString = credentials.expiredTime;
    const date = new Date(isoString);
    const timestamp = date.getTime();
    config.expired = timestamp;
    console.log('✅ STS Token 获取成功');
    return true;
  } catch (error) {
    console.error('❌ 获取 STS Token 失败:', error.message);
    return false;
  }
}

// 获取文件的 Content-Type
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// 上传单个文件
async function uploadFile(client, localPath, remotePath) {
  try {
    const fileContent = fs.readFileSync(localPath);
    const contentType = getContentType(localPath);
    
    await client.putObject({
      bucket: config.bucket,
      key: remotePath,
      body: fileContent,
      contentType: contentType
    });
    
    console.log(`  ✓ ${remotePath}`);
    return true;
  } catch (error) {
    console.error(`  ✗ ${remotePath} - ${error.message}`);
    return false;
  }
}

// 上传整个目录
async function uploadDirectory(env) {
  const envConf = envConfig[env];
  if (!envConf) {
    console.error(`❌ 无效的环境: ${env}，请使用 prod 或 dev`);
    process.exit(1);
  }

  console.log(`\n🚀 开始发布到 ${env} 环境...`);
  console.log(`📦 Bucket: ${config.bucket}`);
  console.log(`📁 目标路径: ${envConf.uploadPath}`);
  
  // 获取 STS Token
  const tokenSuccess = await getStsToken(envConf.apiUrl);
  if (!tokenSuccess) {
    console.error('❌ 无法获取 STS Token，发布终止');
    process.exit(1);
  }
  // 创建 TOS 客户端
  const client = new TosClient({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    stsToken: config.stsToken,
    region: config.region,
    endpoint: config.endpoint
  });

  // dist 目录路径
  const distPath = path.resolve(__dirname, '../main-site/dist');
  
  if (!fs.existsSync(distPath)) {
    console.error(`❌ dist 目录不存在: ${distPath}`);
    console.log('💡 请先运行: cd main-site && yarn build');
    process.exit(1);
  }

  console.log(`\n📂 扫描文件: ${distPath}`);

  // 获取所有文件
  const files = await glob('**/*', {
    cwd: distPath,
    nodir: true,
    dot: true
  });

  console.log(`\n📋 找到 ${files.length} 个文件\n`);

  let successCount = 0;
  let failCount = 0;

  // 上传所有文件
  for (const file of files) {
    const localPath = path.join(distPath, file);
    // 移除开头的斜杠，确保路径格式正确
    const remotePath = path.join(envConf.uploadPath, file).replace(/\\/g, '/');
    console.log(localPath, remotePath);
    const success = await uploadFile(client, localPath, remotePath);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\n✨ 发布完成!`);
  console.log(`✅ 成功: ${successCount} 个文件`);
  if (failCount > 0) {
    console.log(`❌ 失败: ${failCount} 个文件`);
  }
  console.log(`\n🌐 访问地址: https://ad-cdn.itaored.com${envConf.uploadPath}index.html\n`);
}

// 主函数
async function main() {
  const env = process.argv[2] || 'dev';
  
  if (!['prod', 'dev'].includes(env)) {
    console.error('❌ 请指定环境: prod 或 dev');
    console.log('\n用法:');
    console.log('  npm run publish:prod  # 发布到生产环境');
    console.log('  npm run publish:dev   # 发布到开发环境\n');
    process.exit(1);
  }

  await uploadDirectory(env);
}

main().catch(error => {
  console.error('❌ 发布失败:', error);
  process.exit(1);
});
