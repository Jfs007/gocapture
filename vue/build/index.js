const { getBuildTargets } = require('./util.js');
const { spawn, execSync } = require('child_process');

const buildTargets = getBuildTargets();

console.log('构建目标列表:', buildTargets);

// 监听模式
const isWatch = process.argv.includes('--watch');
if (isWatch) {
  buildTargets.forEach(({ name, target, emoji }) => {
    console.log(`${emoji} 启动${name}监听构建...`);
    spawn('vite', ['build', '--watch', '--mode', 'development'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, BUILD_TARGET: target, NODE_ENV: 'development' }
    });
  });
} else {
  // 生产模式
  buildTargets.forEach(({ name, target, emoji }) => {
    console.log(`${emoji} 构建${name}...`);
    execSync(`BUILD_TARGET=${target} NODE_ENV=production vite build --mode production`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  });
}
