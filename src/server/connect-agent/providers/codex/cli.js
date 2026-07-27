'use strict';

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

async function resolveCodexExecutable() {
  const configured = String(process.env.GOCAPTURE_CODEX_PATH || '').trim();
  if (configured) {
    const probe = await execFileResult(configured, ['--version']);
    if (probe.ok) return { executable: configured, versionOutput: probe.stdout || probe.stderr };
  }

  const direct = await execFileResult('codex', ['--version']);
  if (direct.ok) return { executable: 'codex', versionOutput: direct.stdout || direct.stderr };

  const shell = process.env.SHELL || '/bin/zsh';
  const resolved = await execFileResult(shell, ['-lic', 'command -v codex']);
  const executable = resolved.stdout.split(/\r?\n/).map(value => value.trim()).find(Boolean) || '';
  if (!resolved.ok || !executable) {
    return {
      executable: '',
      versionOutput: '',
      error: direct.error || resolved.error || '未找到 Codex CLI',
    };
  }

  const shellProbe = await execFileResult(executable, ['--version']);
  return shellProbe.ok
    ? { executable, versionOutput: shellProbe.stdout || shellProbe.stderr }
    : { executable: '', versionOutput: '', error: shellProbe.error || 'Codex CLI 无法执行' };
}

function normalizeVersion(versionOutput) {
  const match = String(versionOutput || '').match(/(\d+\.\d+\.\d+(?:[-+][^\s]+)?)/);
  return match ? match[1] : String(versionOutput || '').trim();
}

async function inspectCodexCli() {
  const resolved = await resolveCodexExecutable();
  if (!resolved.executable) {
    return {
      installed: false,
      authenticated: false,
      executable: '',
      version: '',
      message: '未检测到 Codex CLI，请先安装并登录 Codex。',
      detail: resolved.error || '',
    };
  }

  const login = await execFileResult(resolved.executable, ['login', 'status']);
  const loginText = [login.stdout, login.stderr].filter(Boolean).join('\n');
  const authenticated = login.ok && /logged in|authenticated/i.test(loginText);
  return {
    installed: true,
    authenticated,
    executable: resolved.executable === 'codex' ? 'codex' : path.resolve(resolved.executable),
    version: normalizeVersion(resolved.versionOutput),
    message: authenticated ? 'Codex 已就绪' : 'Codex CLI 已安装，但尚未登录。',
    detail: authenticated ? loginText : (loginText || login.error),
  };
}

function spawnCodexAppServer(executable) {
  return spawn(executable, ['app-server', '--listen', 'stdio://'], {
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

module.exports = {
  execFileResult,
  inspectCodexCli,
  resolveCodexExecutable,
  spawnCodexAppServer,
};
