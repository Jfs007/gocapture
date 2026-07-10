'use strict';

// 绑定项目时登记 Skills provider（走唯一入口）。没有任何 skill 时注销，保持干净。

const { registerAgentToolProvider, unregisterAgentToolProvider } = require('../tools/registry');
const { loadSkills } = require('./loader');
const { buildSkillsProvider } = require('./provider');

function registerConfiguredSkillProviders(projectPath, options = {}) {
  const onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
  const skills = loadSkills(projectPath);
  if (!skills.length) {
    unregisterAgentToolProvider('builtin.skills');
    return [];
  }
  registerAgentToolProvider(buildSkillsProvider(skills));
  onLog(`Skills 已登记：${skills.map(skill => `${skill.name}(${skill.source})`).join('、')}`);
  return skills;
}

module.exports = {
  registerConfiguredSkillProviders,
};
