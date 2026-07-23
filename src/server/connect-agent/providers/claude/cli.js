'use strict';

// Claude Code CLI 探测 + headless 拉起，对齐 codex/cli.js 的形状。
// 与 Codex 不同：Claude Code 没有"一个长驻 app-server 多路 thread"的模式，而是每个任务
// headless 跑一次 `claude -p --output-format stream-json`，用 --resume <session_id> 续接会话。
const { execFile, spawn } = require('child_process');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 8000;

function execFileResult(command, args, options = {}) {
  return new Promise(resolve => {
    execFile(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: typeof error?.code === 'number' ? error.code : (error ? -1 : 0),
        error: error?.message || '',
        stdout: String(stdout || '').trim(),
        stderr: String(stderr || '').trim(),
      });
    });
  });
}

async function resolveClaudeExecutable() {
  const configured = String(process.env.MAGNUS_CLAUDE_PATH || '').trim();
  if (configured) {
    const probe = await execFileResult(configured, ['--version']);
    if (probe.ok) return { executable: configured, versionOutput: probe.stdout || probe.stderr };
  }

  const direct = await execFileResult('claude', ['--version']);
  if (direct.ok) return { executable: 'claude', versionOutput: direct.stdout || direct.stderr };

  const shell = process.env.SHELL || '/bin/zsh';
  const resolved = await execFileResult(shell, ['-lic', 'command -v claude']);
  const executable = resolved.stdout.split(/\r?\n/).map(value => value.trim()).find(Boolean) || '';
  if (!resolved.ok || !executable) {
    return {
      executable: '',
      versionOutput: '',
      error: direct.error || resolved.error || '未找到 Claude Code CLI',
    };
  }

  const shellProbe = await execFileResult(executable, ['--version']);
  return shellProbe.ok
    ? { executable, versionOutput: shellProbe.stdout || shellProbe.stderr }
    : { executable: '', versionOutput: '', error: shellProbe.error || 'Claude Code CLI 无法执行' };
}

function normalizeVersion(versionOutput) {
  const match = String(versionOutput || '').match(/(\d+\.\d+\.\d+(?:[-+][^\s]+)?)/);
  return match ? match[1] : String(versionOutput || '').trim();
}

// 真实登录检测：claude auth status 输出 JSON（loggedIn/email/subscriptionType）。API-key 模式则看环境变量。
async function detectClaudeAuth(executable) {
  const probe = await execFileResult(executable, ['auth', 'status']);
  try {
    const info = JSON.parse(probe.stdout || '{}');
    if (info.loggedIn) {
      const who = [info.email, info.subscriptionType].filter(Boolean).join(' · ');
      return { authenticated: true, message: `已登录${who ? `：${who}` : ''}`, detail: info.authMethod || '' };
    }
  } catch (error) {
  }
  if (String(process.env.ANTHROPIC_API_KEY || '').trim()) {
    return { authenticated: true, message: '使用 ANTHROPIC_API_KEY', detail: 'env' };
  }
  return { authenticated: false, message: '未登录（可用订阅登录或 API Key 授权）', detail: probe.stderr || '' };
}

async function inspectClaudeCli() {
  const resolved = await resolveClaudeExecutable();
  if (!resolved.executable) {
    return {
      installed: false,
      authenticated: false,
      executable: '',
      version: '',
      message: '未检测到 Claude Code CLI，请先安装（npm i -g @anthropic-ai/claude-code）并登录。',
      detail: resolved.error || '',
    };
  }
  const auth = await detectClaudeAuth(resolved.executable);
  return {
    installed: true,
    authenticated: auth.authenticated,
    executable: resolved.executable === 'claude' ? 'claude' : path.resolve(resolved.executable),
    version: normalizeVersion(resolved.versionOutput),
    message: auth.authenticated ? `Claude Code ${auth.message}` : `Claude Code ${auth.message}`,
    detail: auth.detail,
  };
}

// 授权探针：发一次极小的真实请求，用于验证当前授权(订阅/apikey)能否真正通过 API。
// --output-format json 只回一个最终 JSON，便于判定成功/鉴权失败。
function spawnClaudeProbe(executable, { env } = {}) {
  return spawn(executable, ['-p', 'reply with the single word: OK', '--output-format', 'json'], {
    env: env || process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

// headless 拉起一次 Claude Code：stream-json 事件从 stdout 逐行输出；prompt 通过 stdin 传入（避免超长参数）。
// permissionMode 默认放开权限以便自动改文件（对应 Codex 的 approvalPolicy:never + workspace-write）。
// env 由 client 根据用户授权(订阅/apikey)构建后传入。
function spawnClaudeTask(executable, { cwd, resumeSessionId, permissionMode = 'bypassPermissions', model, env } = {}) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', permissionMode];
  if (model) args.push('--model', model);
  if (resumeSessionId) args.push('--resume', resumeSessionId);
  return spawn(executable, args, {
    cwd,
    env: env || process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

module.exports = {
  execFileResult,
  inspectClaudeCli,
  resolveClaudeExecutable,
  detectClaudeAuth,
  spawnClaudeTask,
  spawnClaudeProbe,
};
