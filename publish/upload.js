import {TosClient} from '@volcengine/tos-sdk';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const accessToken = 'd9d0ccc6930294552decb2afe079287a';
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
        'accessToken': accessToken
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

// 获取远程文件列表（从 file-path.json）
async function getRemoteFileList(client, uploadPath) {
  const filePathJsonKey = `${uploadPath}file-path.json`;
  
  try {
    const { data } = await client.getObjectV2({
      bucket: config.bucket,
      key: filePathJsonKey,
    });
    
    // 读取文件内容
    const chunks = [];
    for await (const chunk of data.content) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    const fileList = JSON.parse(content);
    
    console.log(`✅ 获取到远程文件列表: ${fileList.length} 个文件`);
    return fileList;
  } catch (error) {
    if (error.statusCode === 404) {
      console.log('📁 file-path.json 不存在，这是第一次上传');
      return [];
    }
    console.error('❌ 获取远程文件列表失败:', error.message);
    return [];
  }
}

// 删除旧文件（基于 file-path.json）
async function deleteOldFiles(client, oldFileList) {
  if (oldFileList.length === 0) {
    console.log('\n📁 没有旧文件需要删除\n');
    return;
  }
  
  console.log(`\n🗑️ 开始删除旧文件: ${oldFileList.length} 个`);
  
  let deletedCount = 0;
  let failedCount = 0;
  
  for (const filePath of oldFileList) {
    try {
      await client.deleteObject({
        bucket: config.bucket,
        key: filePath,
      });
      deletedCount++;
      console.log(`  ✓ 已删除: ${filePath}`);
    } catch (error) {
      failedCount++;
      console.error(`  ✗ 删除失败: ${filePath} - ${error.message}`);
    }
  }
  
  console.log(`\n✅ 删除完成: 成功 ${deletedCount} 个, 失败 ${failedCount} 个\n`);
}

// 上传文件路径清单
async function uploadFilePathJson(client, uploadPath, fileList) {
  const filePathJsonKey = `${uploadPath}file-path.json`;
  const content = JSON.stringify(fileList, null, 2);
  
  try {
    await client.putObject({
      bucket: config.bucket,
      key: filePathJsonKey,
      body: Buffer.from(content, 'utf-8'),
      contentType: 'application/json',
    });
    console.log(`\n✅ 已更新 file-path.json (${fileList.length} 个文件)`);
  } catch (error) {
    console.error('❌ 上传 file-path.json 失败:', error.message);
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

  // 获取远程文件列表
  const oldFileList = await getRemoteFileList(client, envConf.uploadPath);
  
  // 删除旧文件
  await deleteOldFiles(client, oldFileList);

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
    const success = await uploadFile(client, localPath, remotePath);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  // 生成新的文件路径列表
  const newFileList = files.map(file => path.join(envConf.uploadPath, file).replace(/\\/g, '/'));
  
  // 上传文件路径清单
  await uploadFilePathJson(client, envConf.uploadPath, newFileList);
  
  console.log(`\n✨ 发布完成!`);
  console.log(`✅ 成功: ${successCount} 个文件`);
  if (failCount > 0) {
    console.log(`❌ 失败: ${failCount} 个文件`);
  }
  console.log(`\n🌐 访问地址: https://ad-cdn.itaored.com/${envConf.uploadPath}index.html\n`);
}

// 构建项目
async function buildProject() {
  console.log('\n📦 开始构建项目...\n');
  
  try {
    const mainSitePath = path.resolve(__dirname, '../main-site');
    
    // 执行 yarn build
    const { stdout, stderr } = await execAsync('yarn build', {
      cwd: mainSitePath,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }
    
    console.log('\n✅ 项目构建完成\n');
  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    throw error;
  }
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

  // 先构建项目
  await buildProject();
  
  // 再上传文件
  await uploadDirectory(env);
}

main().catch(error => {
  console.error('❌ 发布失败:', error);
  process.exit(1);
});
