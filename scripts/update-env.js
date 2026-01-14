#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// 获取命令行参数
const env = process.argv[2];

// 定义环境配置
const envConfigs = {
  prod: {
    source: "https://cdn.itaored.com/static/fed/ldd-chrome-plugin/",
    api: "https://ad.itaored.com/",
    "site": "https://ad-cdn.itaored.com/ad/index.html",
    "env": "prod"
  },
  dev: {
    source: "https://cdn.itaored.com/static/fed/testldd-chrome-plugin/",
    api: "https://testad.itaored.com/",
    "site": "https://ad-cdn.itaored.com/ad/index.html",
    "env": "dev"
  },
  local: {
    source: "https://cdn.itaored.com/static/fed/testldd-chrome-plugin/",
    api: "https://testad.itaored.com/",
    "site": "http://localhost:3000/",
    "env": "local"
  }
};

// 验证参数
if (!env || !envConfigs[env]) {
  console.error('错误: 请提供有效的环境参数 (prod 或 dev 或 local)');
  console.error('用法: node scripts/update-env.js <prod|dev|local>');
  process.exit(1);
}

// manifest.json 文件路径
const manifestPath = path.join(__dirname, '../package/manifest.json');

// 压缩 package 文件夹为 zip
function zipPackage() {
  return new Promise((resolve, reject) => {
    const packageDir = path.join(__dirname, '../package');
    const distDir = path.join(__dirname, '../dist');
    const outputPath = path.join(distDir, 'package.zip');

    // 确保 dist 目录存在
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    // 创建输出流
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高压缩级别
    });

    output.on('close', () => {
      console.log(`📦 压缩完成: ${outputPath}`);
      console.log(`   文件大小: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    // 连接输出流
    archive.pipe(output);

    // 添加 package 目录的所有内容
    archive.directory(packageDir, false);

    // 完成归档
    archive.finalize();
  });
}

try {
  // 读取 manifest.json
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  // 更新 devlopment_env
  manifest.devlopment_env = envConfigs[env];

  // 写回文件,保持格式化
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`✅ 成功更新环境配置为: ${env}`);
  console.log(`   source: ${envConfigs[env].source}`);
  console.log(`   api: ${envConfigs[env].api}`);

  // 压缩 package 文件夹
  zipPackage().then(() => {
    console.log('✅ 所有操作完成');
  }).catch((error) => {
    console.error('❌ 压缩失败:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ 更新失败:', error.message);
  process.exit(1);
}
