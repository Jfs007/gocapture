'use strict';

// Claude Code 授权（订阅 / API key）的归一 + 落盘，让前端登记的授权跨重启保留，并映射成子进程环境变量。
const fs = require('fs');
const os = require('os');
const path = require('path');

const AUTH_PATH = path.join(os.homedir(), '.gocapture', 'connect-agent', 'claude-auth.json');

function normalizeAuth(raw) {
  const mode = raw?.mode === 'apikey' || raw?.mode === 'subscription' ? raw.mode : '';
  return {
    mode,
    apiKey: mode === 'apikey' ? String(raw?.apiKey || '').trim() : '',
    oauthToken: mode === 'subscription' ? String(raw?.oauthToken || raw?.token || '').trim() : '',
    // 代理与授权模式无关，独立保留（区域受限时子进程需靠它才能连通 Anthropic）。
    proxy: String(raw?.proxy || '').trim(),
  };
}

function loadClaudeAuth() {
  try {
    return normalizeAuth(JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8')));
  } catch (error) {
    return { mode: '', apiKey: '', oauthToken: '' };
  }
}

function saveClaudeAuth(auth) {
  try {
    fs.mkdirSync(path.dirname(AUTH_PATH), { recursive: true });
    fs.writeFileSync(AUTH_PATH, JSON.stringify(normalizeAuth(auth)), { mode: 0o600 });
    return true;
  } catch (error) {
    return false;
  }
}

// 把授权映射成子进程 env：apikey → ANTHROPIC_API_KEY；订阅 → 清 key（避免残留 key 劫持）+ 有令牌则用 CLAUDE_CODE_OAUTH_TOKEN。
function authToEnv(auth, baseEnv = process.env) {
  const env = { ...baseEnv };
  if (auth?.mode === 'apikey' && auth.apiKey) {
    env.ANTHROPIC_API_KEY = auth.apiKey;
    delete env.CLAUDE_CODE_OAUTH_TOKEN;
  } else if (auth?.mode === 'subscription') {
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    if (auth.oauthToken) env.CLAUDE_CODE_OAUTH_TOKEN = auth.oauthToken;
  }
  // 代理：区域受限时子进程必须走它才能连通 Anthropic（否则 403 Request not allowed）。
  if (auth?.proxy) {
    for (const key of ['https_proxy', 'http_proxy', 'all_proxy', 'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY']) {
      env[key] = auth.proxy;
    }
  }
  return env;
}

module.exports = {
  AUTH_PATH,
  normalizeAuth,
  loadClaudeAuth,
  saveClaudeAuth,
  authToEnv,
};
