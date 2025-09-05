// 第三方库工具函数，用于访问 other/ 目录中的库文件

export const useLibs = () => {
  const checkLibs = (requiredLibs = []) => {
    const missing = requiredLibs.filter(lib => !window[lib]);
    if (missing.length > 0) {
      console.warn('缺少依赖库:', missing);
      return false;
    }
    return true;
  }

  // 常用库的封装
  const libs = {
    JSZip: () => window.JSZip,
    saveAs: () => window.saveAs,
    // 可以根据 other/ 目录中的库继续扩展
  }

  return {
    ...libs,
    checkLibs,
    
    // 便捷方法：检查并获取库
    getLib: (libName) => {
      if (!window[libName]) {
        console.error(`库 ${libName} 未加载`);
        return null;
      }
      return window[libName];
    },

    // 等待库加载完成
    waitForLibs: (libNames, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const check = () => {
          if (checkLibs(libNames)) {
            resolve(true);
          } else if (Date.now() - startTime > timeout) {
            reject(new Error(`库加载超时: ${libNames.join(', ')}`));
          } else {
            setTimeout(check, 100);
          }
        };
        
        check();
      });
    }
  }
}