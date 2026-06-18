const path = require('path');
const { isTextFile, readProjectText } = require('../core/fs-utils');
const {
  kebabCase,
  makeSnippet,
  uniq,
} = require('../utils');

function isLikelyComponent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.vue', '.jsx', '.tsx'].includes(ext) || /(^|\/)(components?|widgets?|dialog|modal)\//i.test(filePath);
}

function isPageLike(filePath) {
  return /(^|\/)(pages?|views?|routes?|screens?|modules?)\//i.test(filePath);
}

function componentNeedles(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const stem = filePath.slice(0, -ext.length);
  return uniq([
    base,
    kebabCase(base),
    stem,
    `/${stem}`,
    `@/${stem}`,
    `./${base}`,
    `../${base}`,
    `<${base}`,
    `<${kebabCase(base)}`,
  ]).filter(item => item.length >= 3);
}

function reverseComponentUsages(project, hit, textCache) {
  if (!isLikelyComponent(hit.file)) return [];
  const needles = componentNeedles(hit.file).map(item => item.toLowerCase());
  const related = [];

  for (const file of project.files) {
    if (file.path === hit.file || !isTextFile(file.path)) continue;
    try {
      const text = readProjectText(project, file, textCache);
      const lowerText = text.toLowerCase();
      let matched = '';
      let matchedIndex = -1;
      for (const needle of needles) {
        const index = lowerText.indexOf(needle);
        if (index === -1) continue;
        matched = needle;
        matchedIndex = index;
        break;
      }
      if (!matched) continue;
      related.push({
        file: file.path,
        score: Math.round(hit.score * 0.58) + (isPageLike(file.path) ? 80 : 30),
        stage: 'reverse',
        from: hit.file,
        reasons: [
          `组件反查：${hit.file}`,
          `引用命中：${matched}`,
          isPageLike(file.path) ? '路径像页面级文件' : '路径像组件/模块引用',
        ],
        snippet: makeSnippet(text, matchedIndex, matched.length),
      });
    } catch (error) {
    }
  }

  return related
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

module.exports = {
  componentNeedles,
  isLikelyComponent,
  isPageLike,
  reverseComponentUsages,
};
