#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const { getBuildTargets } = require('./build/util');

// 检查命令行参数
const isWatch = process.argv.includes('--watch');
const isDev = process.env.NODE_ENV !== 'production';

console.log('🔥 启动热更新构建系统...');
if (isWatch) {
  console.log('👀 启用文件监听模式');
}

// 构建目标列表
const buildTargets = getBuildTargets();


if (isWatch) {
  // 监听模式 - 并行启动所有构建进程
  console.log('\n🔥 启动热更新监听构建...');
  
  buildTargets.forEach(({ name, target, emoji }) => {
    console.log(`${emoji} 启动${name}热更新监听...`);
    const env = {
      ...process.env,
      BUILD_TARGET: target,
      NODE_ENV: isDev ? 'development' : 'production',
      HOT_RELOAD_MODE: 'app' // 输出到app目录
    };
    
    const child = spawn('vite', ['build', '--watch', '--mode', isDev ? 'development' : 'production'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: __dirname,
      env
    });
    
    child.stdout.on('data', (data) => {
      console.log(`${emoji} [${name}]: ${data.toString().trim()}`);
    });
    
    child.stderr.on('data', (data) => {
      console.error(`${emoji} [${name}] 错误: ${data.toString().trim()}`);
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`${emoji} [${name}] 进程退出，代码: ${code}`);
      }
    });
  });
  
  // 保持进程运行
  process.on('SIGINT', () => {
    console.log('\n👋 停止热更新构建...');
    process.exit(0);
  });
  
} else {
  // 一次性构建模式
  let hasError = false;

  buildTargets.forEach(({ name, target, outputName, emoji }, index) => {
    try {
      console.log(`\n${emoji} 构建${name}到app目录... (${index + 1}/${buildTargets.length})`);
      
      execSync(`BUILD_TARGET=${target} HOT_RELOAD_MODE=app NODE_ENV=${isDev ? 'development' : 'production'} vite build --mode ${isDev ? 'development' : 'production'}`, {
        stdio: 'inherit',
        cwd: __dirname
      });
      
      console.log(`✅ ${name}构建完成 -> app/${outputName}`);
    } catch (error) {
      console.error(`❌ ${name}构建失败:`, error.message);
      hasError = true;
    }
  });

  if (!hasError) {
    console.log('\n🎉 热更新文件构建成功！');
    console.log('📍 热更新文件位置: ../chrome-extension/app/');
    
    try {
      execSync('ls -lh ../chrome-extension/app/', {
        stdio: 'inherit',
        cwd: __dirname
      });
    } catch (error) {
      console.log('📝 文件列表获取失败，但构建已完成');
    }
  } else {
    console.log('\n❌ 热更新构建过程中出现错误');
    process.exit(1);
  }
}