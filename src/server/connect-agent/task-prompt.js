'use strict';

function buildConnectAgentTaskPrompt({
  userInstruction,
  pageUrl,
  selectionBindings,
}) {
  const bindings = Array.isArray(selectionBindings) ? selectionBindings : [];
  const sourceContexts = bindings.flatMap(item => {
    const binding = item?.binding || item || {};
    return (Array.isArray(binding.targets) ? binding.targets : []).map(target => ({
      file: String(target?.file || ''),
      role: String(target?.role || 'related'),
      codeSnippet: String(target?.codeSnippet || ''),
      importChain: Array.isArray(target?.importChain) ? target.importChain.map(String) : [],
      reasons: Array.isArray(target?.reasons) ? target.reasons.map(String) : [],
    }));
  }).filter(item => item.file);
  const investigations = bindings
    .map(item => item?.binding?.investigation || item?.investigation || null)
    .filter(Boolean);
  const originSelections = bindings
    .flatMap(item => item?.binding?.originSelections || item?.originSelections || [])
    .filter(Boolean);

  return [
    '你正在接手 Magnus 已完成源码定位后的开发任务。',
    '',
    '请在当前项目中直接完成用户需求。开始前先阅读项目中的 AGENTS.md 或同等项目规范。',
    'Magnus 提供的定位是已验证的源码证据，但不是对实现范围的硬编码限制；如实现确实需要关联文件，可继续阅读项目源码。',
    '完成后运行与改动相匹配的验证，并在最终回复中简洁说明：修改内容、涉及文件、验证结果、仍存在的风险。',
    '',
    '用户需求：',
    String(userInstruction || '').trim(),
    '',
    `页面：${String(pageUrl || '').trim() || '-'}`,
    '',
    'Magnus 定位的源码上下文：',
    JSON.stringify(sourceContexts, null, 2),
    '',
    'DOM 定位调查结论：',
    JSON.stringify(investigations, null, 2),
    '',
    '原始页面选区证据：',
    JSON.stringify(originSelections, null, 2),
  ].join('\n');
}

module.exports = {
  buildConnectAgentTaskPrompt,
};
