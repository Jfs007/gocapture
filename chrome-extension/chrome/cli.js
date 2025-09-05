(function() {
   window._exports = window._exports || {};
   window._exports.module = Object.assign({}, window._exports.module || {});
   window._require = (name) => {return window._exports.module[name];} 
   window._exports.module['mdChrome'] = {};

   console.log('cli信息注入', window._require, '_r');

}())