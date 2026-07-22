'use strict';

const fs = require('fs');
const path = require('path');

// 项目知识/UI 签名派生的落盘日志：<projectPath>/.magnus/.log（best-effort，不影响主流程）。
const EXPERIENCE_DIR = '.magnus';
const LOG_FILE = '.log';

function knowledgeLogPath(project) {
  return path.join(project.path, EXPERIENCE_DIR, LOG_FILE);
}

function appendKnowledgeLog(project, message) {
  try {
    const file = knowledgeLogPath(project);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch (error) {
    // 落盘失败不影响主流程
  }
}

module.exports = {
  appendKnowledgeLog,
  knowledgeLogPath,
};
