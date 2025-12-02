#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 获取命令行参数
const env = process.argv[2];

// 定义环境配置
const envConfigs = {
  prod: {
    source: "https://cdn.itaored.com/static/fed/ldd-chrome-plugin/",
    api: "https://ad.itaored.com/"
  },
  dev: {
    source: "https://cdn.itaored.com/static/fed/testldd-chrome-plugin/",
    api: "https://testad.itaored.com/"
  }
};

// 验证参数
if (!env || !envConfigs[env]) {
  console.error('错误: 请提供有效的环境参数 (prod 或 dev)');
  console.error('用法: node scripts/update-env.js <prod|dev>');
  process.exit(1);
}

// manifest.json 文件路径
const manifestPath = path.join(__dirname, '../package/manifest.json');

try {
  // 读取 manifest.json
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  // 更新 devlopment_env
  manifest.devlopment_env = envConfigs[env];

  // 写回文件，保持格式化
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`✅ 成功更新环境配置为: ${env}`);
  console.log(`   source: ${envConfigs[env].source}`);
  console.log(`   api: ${envConfigs[env].api}`);
} catch (error) {
  console.error('❌ 更新失败:', error.message);
  process.exit(1);
}
