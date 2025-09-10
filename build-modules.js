#!/usr/bin/env node

/**
 * cp_modules构建脚本
 * 自动读取src/cp_modules下的所有模块，压缩后注入到src/chrome/web.js中
 */

const fs = require('fs');
const path = require('path');

// 配置路径
const CP_MODULES_DIR = './src/cp_modules';
const WEB_JS_PATH = './src/chrome/web.js';
const WEB_JS_TEMPLATE_PATH = './src/chrome/web.template.js';

/**
 * 压缩JavaScript代码 (简单版)
 */
function minifyJS(code) {
    return code
        .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
        .replace(/\/\/.*$/gm, '') // 移除单行注释
        .replace(/\s+/g, ' ') // 压缩空白字符
        .replace(/\s*([{}();,])\s*/g, '$1') // 移除操作符周围空格
        .trim();
}

/**
 * 转义字符串用于JavaScript字符串字面量
 */
function escapeString(str) {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

/**
 * 扫描并读取所有cp_modules
 */
function scanModules() {
    const modules = {};
    
    if (!fs.existsSync(CP_MODULES_DIR)) {
        console.log('❌ cp_modules目录不存在');
        return modules;
    }
    
    const moduleDirs = fs.readdirSync(CP_MODULES_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    
    for (const moduleName of moduleDirs) {
        const modulePath = path.join(CP_MODULES_DIR, moduleName, 'index.js');
        
        if (fs.existsSync(modulePath)) {
            try {
                const moduleCode = fs.readFileSync(modulePath, 'utf8');
                const minifiedCode = minifyJS(moduleCode);
                modules[moduleName] = minifiedCode;
                console.log(`✅ 读取模块: ${moduleName} (${moduleCode.length} -> ${minifiedCode.length} bytes)`);
            } catch (error) {
                console.error(`❌ 读取模块失败: ${moduleName}`, error.message);
            }
        } else {
            console.warn(`⚠️ 模块文件不存在: ${modulePath}`);
        }
    }
    
    return modules;
}

/**
 * 生成内联模块代码
 */
function generateInlineModulesCode(modules) {
    const moduleEntries = Object.entries(modules).map(([name, code]) => {
        return `            '${name}': '${escapeString(code)}'`;
    });
    
    return `        // 内联模块代码映射 - 自动生成，请勿手动修改
        const inlineModules = {
${moduleEntries.join(',\n')}
        };`;
}

/**
 * 更新web.js文件
 */
function updateWebJS(modules) {
    let webJSContent = '';
    
    // 如果存在模板文件，使用模板
    if (fs.existsSync(WEB_JS_TEMPLATE_PATH)) {
        webJSContent = fs.readFileSync(WEB_JS_TEMPLATE_PATH, 'utf8');
    } else if (fs.existsSync(WEB_JS_PATH)) {
        // 否则使用现有的web.js
        webJSContent = fs.readFileSync(WEB_JS_PATH, 'utf8');
    } else {
        console.error('❌ 找不到web.js文件或模板文件');
        return false;
    }
    
    // 生成新的内联模块代码
    const inlineModulesCode = generateInlineModulesCode(modules);
    
    // 查找并替换内联模块部分
    const startMarker = '        // 内联模块代码映射';
    const endMarker = '        };';
    
    const startIndex = webJSContent.indexOf(startMarker);
    if (startIndex === -1) {
        console.error('❌ 在web.js中找不到内联模块代码标记');
        return false;
    }
    
    // 找到结束标记
    let endIndex = webJSContent.indexOf(endMarker, startIndex);
    if (endIndex === -1) {
        console.error('❌ 在web.js中找不到内联模块结束标记');
        return false;
    }
    endIndex += endMarker.length;
    
    // 替换内容
    const newContent = webJSContent.substring(0, startIndex) + 
                      inlineModulesCode + '\n' +
                      webJSContent.substring(endIndex);
    
    // 写入文件
    try {
        fs.writeFileSync(WEB_JS_PATH, newContent, 'utf8');
        console.log(`✅ web.js已更新，包含${Object.keys(modules).length}个模块`);
        return true;
    } catch (error) {
        console.error('❌ 写入web.js失败:', error.message);
        return false;
    }
}

/**
 * 主函数
 */
function main() {
    console.log('🔥 开始构建cp_modules...\n');
    
    // 1. 扫描模块
    const modules = scanModules();
    const moduleCount = Object.keys(modules).length;
    
    if (moduleCount === 0) {
        console.log('⚠️ 没有找到任何模块');
        return;
    }
    
    console.log(`\n📦 找到${moduleCount}个模块:`, Object.keys(modules).join(', '));
    
    // 2. 更新web.js
    if (updateWebJS(modules)) {
        console.log('\n🎉 cp_modules构建完成！');
    } else {
        console.log('\n❌ cp_modules构建失败！');
        process.exit(1);
    }
}

// 支持监听模式
if (process.argv.includes('--watch')) {
    console.log('👀 启动监听模式...');
    
    // 首次构建
    main();
    
    // 监听cp_modules目录变化
    const chokidar = require('chokidar');
    const watcher = chokidar.watch(CP_MODULES_DIR, {
        ignored: /node_modules/,
        persistent: true
    });
    
    watcher.on('change', (filePath) => {
        console.log(`\n📝 文件变更: ${filePath}`);
        main();
    });
    
    watcher.on('add', (filePath) => {
        console.log(`\n➕ 文件添加: ${filePath}`);
        main();
    });
    
    watcher.on('unlink', (filePath) => {
        console.log(`\n➖ 文件删除: ${filePath}`);
        main();
    });
    
} else {
    // 单次构建
    main();
}