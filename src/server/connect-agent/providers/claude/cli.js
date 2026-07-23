'use strict';

// Claude Code CLI 探测 + headless 拉起，对齐 codex/cli.js 的形状。
// 与 Codex 不同：Claude Code 没有"一个长驻 app-server 多路 thread"的模式，而是每个任务
// headless 跑一次 `claude -p --output-format stream-json`，用 --resume <session_id> 续接会话。
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
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

// Claude Code 的登录凭据可能在环境变量、也可能在 ~/.claude/.credentials.json 或系统钥匙串。
// 无法 100% 判定时倾向"认为已登录"（真正没登录会在任务运行时报明确错误），避免误判成 login-required 卡死。
function detectClaudeAuth() {
  if (String(process.env.ANTHROPIC_API_KEY || '').trim()) return { authenticated: true, source: 'ANTHROPIC_API_KEY' };
  if (String(process.env.CLAUDE_CODE_OAUTH_TOKEN || '').trim()) return { authenticated: true, source: 'CLAUDE_CODE_OAUTH_TOKEN' };
  const credentialsPath = path.join(os.homedir(), '.claude', '.credentials.json');
  try {
    if (fs.existsSync(credentialsPath)) return { authenticated: true, source: credentialsPath };
  } catch (error) {
  }
  // 判定不出 → 乐观放行，交由运行期报错。
  return { authenticated: true, source: 'assumed', assumed: true };
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
  const auth = detectClaudeAuth();
  return {
    installed: true,
    authenticated: auth.authenticated,
    executable: resolved.executable === 'claude' ? 'claude' : path.resolve(resolved.executable),
    version: normalizeVersion(resolved.versionOutput),
    message: auth.assumed
      ? 'Claude Code 已安装（未显式检测到登录凭据，将在任务运行时校验）'
      : 'Claude Code 已就绪',
    detail: auth.source,
  };
}

// 子进程认证环境：解决 server 起的 claude 与你终端认证不一致导致的 403。
// - MAGNUS_CLAUDE_API_KEY 设了 → 用它作 ANTHROPIC_API_KEY（显式 API-key 模式）。
// - 否则若 MAGNUS_CLAUDE_USE_LOGIN 为真 → 清掉环境里残留的 key，强制用已登录的订阅会话
//   （最常见的 403 就是残留 key 劫持了订阅登录）。
// - 默认原样透传，不改变既有行为。
function buildClaudeEnv() {
  const env = { ...process.env };
  const apiKey = String(process.env.MAGNUS_CLAUDE_API_KEY || '').trim();
  if (apiKey) {
    env.ANTHROPIC_API_KEY = apiKey;
  } else if (String(process.env.MAGNUS_CLAUDE_USE_LOGIN || '').trim()) {
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
  }
  return env;
}

// headless 拉起一次 Claude Code：stream-json 事件从 stdout 逐行输出；prompt 通过 stdin 传入（避免超长参数）。
// permissionMode 默认放开权限以便自动改文件（对应 Codex 的 approvalPolicy:never + workspace-write）。
function spawnClaudeTask(executable, { cwd, resumeSessionId, permissionMode = 'bypassPermissions', model } = {}) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', permissionMode];
  if (model) args.push('--model', model);
  if (resumeSessionId) args.push('--resume', resumeSessionId);
  return spawn(executable, args, {
    cwd,
    env: buildClaudeEnv(),
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
};
