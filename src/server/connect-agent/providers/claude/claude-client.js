'use strict';

// Claude Code 连接 provider，对齐 CodexAppServerClient 的对外接口
// （inspect / connect / disconnect / close / status / runTask），前端可一视同仁。
// 机制差异：Claude Code 每个任务 headless 跑一次 `claude -p --output-format stream-json`，
// 用 --resume <session_id> 续接会话。会话 id 按 cwd(项目) 记忆 → 同项目后续任务自动带上下文
// （这正是 Codex 那套目前缺的“跨请求上下文”，这里一开始就做对）。
const readline = require('readline');
const crypto = require('crypto');
const { inspectClaudeCli, spawnClaudeTask, spawnClaudeProbe } = require('./cli');
const { normalizeAuth, loadClaudeAuth, saveClaudeAuth, authToEnv } = require('./auth-store');

const PROBE_TIMEOUT_MS = 60 * 1000;
// Claude 常把鉴权/网络失败当"文本回复"打出来(subtype 仍 success)，故除退出码/is_error 外，也按文本特征判失败。
const AUTH_FAIL_RE = /API Error:\s*40[13]|Failed to authenticate|not allowed|Invalid API key|unauthor/i;
// 区域/网络受限：Anthropic 直连被拒(403 Request not allowed)，多为所在区域需走代理。
const REGION_BLOCK_RE = /Request not allowed|\b403\b/i;

function explainProbeFailure(text) {
  if (REGION_BLOCK_RE.test(text)) {
    return '请求受限：该区域无法直连 Anthropic（403 Request not allowed）。请在授权里配置代理后重试。';
  }
  if (/Invalid API key|Failed to authenticate|unauthor|\b401\b/i.test(text)) {
    return '授权无效：请改用有效的 API Key，或重新登录订阅（claude setup-token / claude auth login）。';
  }
  return '授权验证失败';
}

const TASK_TIMEOUT_MS = 30 * 60 * 1000;
const FILE_EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'create_file', 'str_replace_editor']);

class ClaudeCodeClient {
  constructor(options = {}) {
    this.inspectCli = options.inspectCli || inspectClaudeCli;
    this.spawnTask = options.spawnTask || spawnClaudeTask;
    this.spawnProbe = options.spawnProbe || spawnClaudeProbe;
    this.permissionMode = options.permissionMode || process.env.MAGNUS_CLAUDE_PERMISSION_MODE || 'bypassPermissions';
    this.model = options.model || process.env.MAGNUS_CLAUDE_MODEL || '';
    this.tasks = new Map();   // taskId -> { child, task }
    this.sessions = new Map(); // cwd -> sessionId（跨任务续接上下文）
    this.state = 'disconnected';
    this.lastError = '';
    this.cli = null;
    // 用户授权（订阅 / apikey）：构造时从盘上恢复；连接时可携带新授权覆盖并落盘。
    this.auth = options.auth ? normalizeAuth(options.auth) : (options.loadAuth || loadClaudeAuth)();
    this.saveAuth = options.saveAuth || saveClaudeAuth;
  }

  async inspect() {
    this.cli = await this.inspectCli();
    return this.status();
  }

  async connect(options = {}) {
    this.state = 'checking';
    this.lastError = '';
    // 连接时可携带授权（订阅/apikey）→ 覆盖并落盘。
    if (options && options.auth) {
      this.auth = normalizeAuth(options.auth);
      this.saveAuth(this.auth);
    }
    const cli = await this.inspectCli();
    this.cli = cli;
    if (!cli.installed) {
      this.state = 'unavailable';
      throw new Error(cli.message);
    }
    // 真实验证：用当前授权发一次极小请求，确认能通过 API（auth status 只查本地凭据，过不了会 403）。
    const probe = await this.probeAuth();
    if (!probe.ok) {
      this.state = 'error';
      this.lastError = probe.message;
      throw new Error(probe.message);
    }
    this.state = 'connected';
    return this.status();
  }

  probeAuth() {
    return new Promise(resolve => {
      let out = '';
      let err = '';
      let child;
      try {
        child = this.spawnProbe(this.cli?.executable || 'claude', { env: authToEnv(this.auth) });
      } catch (error) {
        resolve({ ok: false, message: `授权验证失败：${error.message}` });
        return;
      }
      const timer = setTimeout(() => {
        if (!child.killed) child.kill('SIGTERM');
        resolve({ ok: false, message: '授权验证超时（60s），请检查网络或登录状态。' });
      }, PROBE_TIMEOUT_MS);
      child.stdout?.on('data', chunk => { out += chunk; });
      child.stderr?.on('data', chunk => { err += chunk; });
      child.on('error', error => { clearTimeout(timer); resolve({ ok: false, message: `授权验证失败：${error.message}` }); });
      child.on('exit', code => {
        clearTimeout(timer);
        let info = null;
        try { info = JSON.parse(String(out).trim().split('\n').filter(Boolean).pop() || ''); } catch (error) {}
        const text = String(info?.result || out || err || '');
        if (info && info.type === 'result' && !info.is_error && !AUTH_FAIL_RE.test(text)) {
          resolve({ ok: true, message: '' });
          return;
        }
        const hint = AUTH_FAIL_RE.test(text)
          ? explainProbeFailure(text)
          : `授权验证失败${code != null ? `（退出码 ${code}）` : ''}`;
        resolve({ ok: false, message: `${hint}${text ? `：${text.slice(0, 200)}` : ''}` });
      });
    });
  }

  disconnect() {
    this.stopAllTasks('Claude Code 连接已断开');
    this.state = 'disconnected';
    this.lastError = '';
    return this.status();
  }

  close() {
    this.stopAllTasks('Claude Code 服务已关闭');
  }

  isConnected() {
    return this.state === 'connected';
  }

  status() {
    return {
      id: 'claude',
      name: 'Claude Code',
      category: 'connection',
      state: this.isConnected() ? 'connected' : this.state,
      connected: this.isConnected(),
      installed: !!this.cli?.installed,
      // 已登录(OAuth) 或 已在本工具登记授权(apikey/订阅令牌) 都算已授权。
      authenticated: !!this.cli?.authenticated || !!this.auth.mode,
      version: this.cli?.version || '',
      executable: this.cli?.executable || '',
      message: this.statusMessage(),
      error: this.lastError,
      activeTaskCount: this.tasks.size,
      // 授权元数据：前端据此展示"订阅/apikey"授权入口与当前状态（不回传密钥本身）。
      authModes: ['subscription', 'apikey'],
      authMode: this.auth.mode || '',
      authConfigured: !!this.auth.mode,
      supportsProxy: true,
      proxy: this.auth.proxy || '', // 非密钥，回传供前端预填
    };
  }

  statusMessage() {
    if (this.isConnected()) return `已连接 Claude Code${this.cli?.version ? ` ${this.cli.version}` : ''}`;
    if (this.state === 'checking') return '正在检查 Claude Code 环境…';
    if (this.state === 'unavailable') return '未检测到 Claude Code CLI';
    if (this.state === 'error') return this.lastError || 'Claude Code 连接失败';
    if (this.cli?.installed) return `Claude Code ${this.cli.version || ''} 可以连接`.trim();
    return this.cli?.message || '尚未连接';
  }

  async runTask({
    taskId = `task_${crypto.randomUUID().replace(/-/g, '')}`,
    cwd,
    prompt,
    onEvent = () => {},
    signal,
  }) {
    if (!cwd) throw new Error('Claude Code 任务缺少项目目录');
    if (!String(prompt || '').trim()) throw new Error('Claude Code 任务缺少开发要求');
    if (!this.isConnected()) await this.connect();

    const task = {
      taskId,
      sessionId: '',
      status: 'starting',
      startedAt: Date.now(),
      finishedAt: 0,
      finalResponse: '',
      changedFiles: new Set(),
      error: '',
    };
    const resumeSessionId = this.sessions.get(cwd) || '';
    onEvent({ type: 'task-started', task: publicTask(task), message: `Claude Code 开发任务已创建：${taskId}` });

    const child = this.spawnTask(this.cli?.executable || 'claude', {
      cwd,
      resumeSessionId,
      permissionMode: this.permissionMode,
      model: this.model,
      env: authToEnv(this.auth),
    });
    const entry = { child, task };
    this.tasks.set(taskId, entry);

    const stderrTail = [];
    let settled = false;
    return await new Promise((resolve, reject) => {
      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(arg);
      };
      const onAbort = () => {
        task.status = 'cancelled';
        if (child && !child.killed) child.kill('SIGTERM');
        finish(reject, taskError(task, new Error('Claude Code 开发任务已取消')));
      };
      const timeoutId = setTimeout(() => {
        task.status = 'failed';
        if (child && !child.killed) child.kill('SIGTERM');
        finish(reject, taskError(task, new Error('Claude Code 开发任务执行超时')));
      }, TASK_TIMEOUT_MS);
      const reader = readline.createInterface({ input: child.stdout });

      function cleanup() {
        clearTimeout(timeoutId);
        reader.close();
        signal?.removeEventListener?.('abort', onAbort);
        // 记住会话 id → 同项目后续任务续接上下文。
      }

      if (signal?.aborted) { onAbort(); return; }
      signal?.addEventListener?.('abort', onAbort, { once: true });

      reader.on('line', line => {
        const event = parseJsonLine(line);
        if (!event) return;
        const description = updateTaskFromEvent(task, event, FILE_EDIT_TOOLS);
        if (task.sessionId && cwd) this.sessions.set(cwd, task.sessionId);
        // 用 publicTask（含 finalResponse）：前端通用 store 靠 event.task.finalResponse 增量显示回复。
        onEvent({ type: 'agent-event', task: publicTask(task), event, message: description });
        if (event.type === 'result') {
          task.status = event.subtype === 'success' ? 'completed' : String(event.subtype || 'failed');
          task.finishedAt = Date.now();
          const result = publicTask(task);
          onEvent({
            type: 'task-completed',
            task: result,
            message: task.status === 'completed' ? 'Claude Code 开发任务已完成' : `Claude Code 开发任务结束：${task.status}`,
          });
          if (event.is_error) finish(reject, taskError(task, new Error(task.finalResponse || 'Claude Code 开发任务执行失败')));
          else finish(resolve, result);
        }
      });

      child.stderr?.on('data', chunk => {
        const lines = String(chunk || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        stderrTail.push(...lines);
        if (stderrTail.length > 12) stderrTail.splice(0, stderrTail.length - 12);
      });
      child.on('error', error => {
        task.status = 'failed';
        finish(reject, taskError(task, error));
      });
      child.on('exit', (code, sig) => {
        if (settled) return;
        // 正常应在 result 事件里已 settle；走到这里说明进程提前退出且没给 result。
        const detail = stderrTail.slice(-4).join('；');
        const message = `Claude Code 进程提前退出${code != null ? `（退出码 ${code}）` : ''}${sig ? `（${sig}）` : ''}${detail ? `：${detail}` : ''}`;
        task.status = 'failed';
        task.finishedAt = Date.now();
        finish(reject, taskError(task, new Error(message)));
      });

      // prompt 通过 stdin 传入，避免超长参数。
      try {
        child.stdin.write(String(prompt));
        child.stdin.end();
      } catch (error) {
        finish(reject, taskError(task, error));
      }
    }).finally(() => {
      this.tasks.delete(taskId);
    });
  }

  stopAllTasks(reason) {
    for (const { child, task } of this.tasks.values()) {
      task.error = task.error || reason;
      if (child && !child.killed) child.kill('SIGTERM');
    }
    this.tasks.clear();
  }
}

function parseJsonLine(line) {
  const text = String(line || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

// 消费一条 stream-json 事件：更新 task（session/回复/改动文件），返回一句人读描述。
function updateTaskFromEvent(task, event, fileEditTools) {
  const type = String(event?.type || '');
  if (event?.session_id && !task.sessionId) task.sessionId = String(event.session_id);

  if (type === 'system' && event.subtype === 'init') {
    task.status = 'running';
    return `Claude Code 会话已启动${task.sessionId ? `：${task.sessionId}` : ''}`;
  }
  if (type === 'assistant') {
    const blocks = Array.isArray(event?.message?.content) ? event.message.content : [];
    const notes = [];
    for (const block of blocks) {
      if (block?.type === 'text' && String(block.text || '').trim()) {
        task.finalResponse = String(block.text);
        notes.push('生成回复');
      }
      if (block?.type === 'tool_use') {
        const tool = String(block.name || '工具');
        const file = String(block?.input?.file_path || block?.input?.path || block?.input?.notebook_path || '');
        if (fileEditTools.has(tool) && file) task.changedFiles.add(file);
        notes.push(describeToolUse(tool, block?.input || {}, file));
      }
    }
    return notes.filter(Boolean).map(note => `Claude 使用：${note}`).join('\n');
  }
  if (type === 'user') {
    return ''; // tool_result 回填，无需噪声
  }
  if (type === 'result') {
    if (String(event.result || '').trim()) task.finalResponse = String(event.result);
    return `Claude Code 结束：${event.subtype || 'result'}`;
  }
  return '';
}

function describeToolUse(tool, input, file) {
  if (tool === 'Bash') return `执行命令 ${String(input.command || '').slice(0, 120)}`.trim();
  if (file) return `${tool} ${file}`;
  if (tool === 'Read' || tool === 'Grep' || tool === 'Glob') return `${tool} ${String(input.pattern || input.file_path || input.path || '')}`.trim();
  return tool;
}

function publicTask(task) {
  return {
    taskId: task.taskId,
    threadId: task.sessionId,
    sessionId: task.sessionId,
    status: task.status,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    finalResponse: task.finalResponse,
    changedFiles: [...task.changedFiles],
    error: task.error || '',
  };
}

function taskError(task, error) {
  task.error = error?.message || String(error);
  task.finishedAt = task.finishedAt || Date.now();
  return Object.assign(new Error(task.error), { task: publicTask(task) });
}

module.exports = {
  ClaudeCodeClient,
  updateTaskFromEvent,
  describeToolUse,
};
