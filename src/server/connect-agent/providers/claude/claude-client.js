'use strict';

const { applyStructuredTaskResult } = require('../../structured-task-result');

// Claude Code 连接 provider，对齐 CodexAppServerClient 的对外接口
// （inspect / connect / disconnect / close / status / runTask），前端可一视同仁。
// 机制差异：Claude Code 每个任务 headless 跑一次 `claude -p --output-format stream-json`，
// 用 --resume <session_id> 续接会话。会话 id 按 cwd(项目) 记忆 → 同项目后续任务自动带上下文
// （这正是 Codex 那套目前缺的“跨请求上下文”，这里一开始就做对）。
const readline = require('readline');
const crypto = require('crypto');
const { inspectClaudeCli, spawnClaudeTask, spawnClaudeProbe } = require('./cli');
const { normalizeAuth, loadClaudeAuth, saveClaudeAuth, authToEnv } = require('./auth-store');
const {
  CLAUDE_MODEL_BACKENDS,
  loadRuntimeConfig,
  normalizeRuntimeConfig,
  runtimeConfigToEnv,
  saveRuntimeConfig,
  validateRuntimeConfig,
} = require('./runtime-config');
const { AgentAdapter } = require('../../core/agent-adapter');
const {
  MODEL_PROTOCOLS,
  assertModelBackendCompatible,
  getModelBackend,
  listModelBackends,
} = require('../../core/model-backends');

const PROBE_TIMEOUT_MS = 60 * 1000;
// Claude 常把鉴权/网络失败当"文本回复"打出来(subtype 仍 success)，故除退出码/is_error 外，也按文本特征判失败。
const AUTH_FAIL_RE = /API Error:\s*40[13]|Failed to authenticate|not allowed|Invalid API key|api key.*invalid|unauthor/i;
// 区域/网络受限：Anthropic 直连被拒(403 Request not allowed)，多为所在区域需走代理。
const REGION_BLOCK_RE = /Request not allowed|\b403\b/i;

function explainProbeFailure(text, provider = 'anthropic') {
  const serviceName = provider === 'deepseek' ? 'DeepSeek' : 'Anthropic';
  if (REGION_BLOCK_RE.test(text)) {
    return `请求受限：当前环境无法连接 ${serviceName}（403 Request not allowed）。请检查 Endpoint、账户权限或代理。`;
  }
  if (/Invalid API key|Failed to authenticate|unauthor|\b401\b/i.test(text)) {
    return provider === 'deepseek'
      ? 'DeepSeek 授权无效：请检查 API Key 与 Anthropic 兼容 Endpoint。'
      : '授权无效：请改用有效的 API Key，或重新登录订阅（claude setup-token / claude auth login）。';
  }
  return '授权验证失败';
}

const TASK_TIMEOUT_MS = 30 * 60 * 1000;
const FILE_EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'create_file', 'str_replace_editor']);

class ClaudeCodeClient extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'claude',
      name: 'Claude Code',
      capabilities: {
        proxy: true,
        threadBinding: false,
        requiresThreadBinding: false,
        modelBackendConfiguration: true,
      },
      modelProtocols: [MODEL_PROTOCOLS.ANTHROPIC_MESSAGES],
      modelBackends: CLAUDE_MODEL_BACKENDS,
    });
    this.inspectCli = options.inspectCli || inspectClaudeCli;
    this.spawnTask = options.spawnTask || spawnClaudeTask;
    this.spawnProbe = options.spawnProbe || spawnClaudeProbe;
    this.fetch = options.fetch || globalThis.fetch;
    this.permissionMode = options.permissionMode || process.env.GOCAPTURE_CLAUDE_PERMISSION_MODE || 'bypassPermissions';
    this.model = options.model || process.env.GOCAPTURE_CLAUDE_MODEL || '';
    this.tasks = new Map();   // taskId -> { child, task }
    this.sessions = new Map(); // cwd -> sessionId（跨任务续接上下文）
    this.state = 'disconnected';
    this.lastError = '';
    this.cli = null;
    // 用户授权（订阅 / apikey）：构造时从盘上恢复；连接时可携带新授权覆盖并落盘。
    this.auth = options.auth ? normalizeAuth(options.auth) : (options.loadAuth || loadClaudeAuth)();
    this.saveAuth = options.saveAuth || saveClaudeAuth;
    this.runtimeConfig = normalizeRuntimeConfig(
      options.runtimeConfig || (options.loadRuntimeConfig || loadRuntimeConfig)(),
    );
    this.saveRuntimeConfig = options.saveRuntimeConfig || saveRuntimeConfig;
  }

  setProxy(proxy) {
    this.auth = normalizeAuth({
      ...this.auth,
      proxy: String(proxy || '').trim(),
    });
  }

  configureProject(settings = {}) {
    this.setProxy(settings.proxy);
  }

  async inspect() {
    this.cli = await this.inspectCli();
    return this.status();
  }

  async connect(options = {}) {
    this.state = 'checking';
    this.lastError = '';
    const previousAuth = this.auth;
    const previousRuntimeConfig = this.runtimeConfig;
    const hasAuthUpdate = !!options?.auth;
    const hasRuntimeUpdate = !!options?.runtimeConfig;
    // 先将新配置放入内存供探针验证；验证成功后再落盘。
    if (options && options.auth) {
      this.auth = normalizeAuth(options.auth);
    }
    if (options && options.runtimeConfig) {
      this.runtimeConfig = normalizeRuntimeConfig(options.runtimeConfig);
    }
    try {
      const runtimeConfigError = validateRuntimeConfig(this.runtimeConfig, this.manifest);
      if (runtimeConfigError) throw new Error(runtimeConfigError);
      assertModelBackendCompatible(this.manifest, this.runtimeConfig.backendId);
      const cli = await this.inspectCli();
      this.cli = cli;
      if (!cli.installed) {
        this.state = 'unavailable';
        throw new Error(cli.message);
      }
      // DeepSeek 先直连兼容 API，避免 Claude CLI 在 401 时持续重试直到超时。
      const probe = this.runtimeConfig.backendId !== 'inherit'
        && this.runtimeConfig.backendId !== 'anthropic'
        && !this.auth.proxy
        ? await this.probeAnthropicCompatibleApi()
        : await this.probeAuth();
      if (!probe.ok) {
        this.state = 'error';
        this.lastError = probe.message;
        throw new Error(probe.message);
      }
      if (hasAuthUpdate && !this.saveAuth(this.auth)) {
        throw new Error('Claude Code 授权配置保存失败');
      }
      if (hasRuntimeUpdate && !this.saveRuntimeConfig(this.runtimeConfig)) {
        throw new Error('Claude Code 运行模型配置保存失败');
      }
      this.state = 'connected';
      return this.status();
    } catch (error) {
      if (hasAuthUpdate) this.auth = previousAuth;
      if (hasRuntimeUpdate) this.runtimeConfig = previousRuntimeConfig;
      throw error;
    }
  }

  async probeAnthropicCompatibleApi() {
    const backend = getModelBackend(this.runtimeConfig.backendId);
    const backendName = backend?.name || '模型后端';
    if (this.auth.mode !== 'apikey' || !this.auth.apiKey) {
      return { ok: false, message: `${backendName} 连接缺少 API Key` };
    }
    if (typeof this.fetch !== 'function') {
      return this.probeAuth();
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15 * 1000);
    try {
      const baseUrl = String(this.runtimeConfig.baseUrl || '').replace(/\/+$/, '');
      const response = await this.fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': this.auth.apiKey,
        },
        body: JSON.stringify({
          model: this.runtimeConfig.fastModel || this.runtimeConfig.model || 'deepseek-v4-flash',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'OK' }],
        }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) return { ok: true, message: '' };
      const detail = String(body?.error?.message || body?.message || `HTTP ${response.status}`);
      if (response.status === 401 || response.status === 403) {
        return { ok: false, message: `${backendName} 授权失败：${detail}` };
      }
      return { ok: false, message: `${backendName} API 验证失败：${detail}` };
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { ok: false, message: `${backendName} API 验证超时（15s），请检查网络或代理` };
      }
      return { ok: false, message: `${backendName} API 验证失败：${error.message}` };
    } finally {
      clearTimeout(timer);
    }
  }

  probeAuth() {
    return new Promise(resolve => {
      let out = '';
      let err = '';
      let child;
      try {
        child = this.spawnProbe(this.cli?.executable || 'claude', {
          env: this.claudeEnv(),
        });
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
          ? explainProbeFailure(text, this.runtimeConfig.backendId)
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
    return this.publicStatus({
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
      authBackendId: this.auth.backendId || '',
      authConfigured: !!this.auth.mode,
      supportsProxy: true,
      proxy: this.auth.proxy || '', // 非密钥，回传供前端预填
      supportsRuntimeConfig: true,
      runtimeConfig: { ...this.runtimeConfig },
      availableModelBackends: listModelBackends(this.manifest.modelBackends),
    });
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
    outputSchema,
    threadId = '',
    onThread = () => {},
    onEvent = () => {},
    signal,
  }) {
    if (!cwd) throw new Error('Claude Code 任务缺少项目目录');
    if (!String(prompt || '').trim()) throw new Error('Claude Code 任务缺少开发要求');
    if (!this.isConnected()) await this.connect();

    const resumeSessionId = String(threadId || this.sessions.get(cwd) || '').trim();
    const task = {
      taskId,
      // `--resume` 指向的是项目级稳定会话。Claude stream 中后续出现的
      // session_id 可能只属于本次调用，不能覆盖它。
      sessionId: resumeSessionId,
      status: 'starting',
      startedAt: Date.now(),
      finishedAt: 0,
      finalResponse: '',
      selectionLocations: [],
      changedFiles: new Set(),
      error: '',
    };
    let persistedSessionId = '';
    onEvent({ type: 'task-started', task: publicTask(task), message: `Claude Code 开发任务已创建：${taskId}` });

    const structuredPrompt = outputSchema
      ? `${prompt}\n\n最终只返回符合以下 JSON Schema 的 JSON：\n${JSON.stringify(outputSchema)}`
      : prompt;
    const child = this.spawnTask(this.cli?.executable || 'claude', {
      cwd,
      resumeSessionId,
      prompt: structuredPrompt,
      permissionMode: this.permissionMode,
      model: this.runtimeConfig.model || this.model,
      env: this.claudeEnv(),
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
        const isSessionInit = event.type === 'system' && event.subtype === 'init';
        const canPersistSession = !!resumeSessionId || isSessionInit;
        if (task.sessionId && cwd && canPersistSession) {
          this.sessions.set(cwd, task.sessionId);
          if (task.sessionId !== persistedSessionId) {
            persistedSessionId = task.sessionId;
            onThread({
              threadId: task.sessionId,
              resumed: !!resumeSessionId && task.sessionId === resumeSessionId,
            });
          }
        }
        // 用 publicTask（含 finalResponse）：前端通用 store 靠 event.task.finalResponse 增量显示回复。
        onEvent({ type: 'agent-event', task: publicTask(task), event, message: description });
        if (event.type === 'result') {
          task.status = event.subtype === 'success' ? 'completed' : String(event.subtype || 'failed');
          task.finishedAt = Date.now();
          normalizeStructuredTaskResult(task);
          const result = publicTask(task);
          onEvent({
            type: 'task-completed',
            task: result,
            message: task.status === 'completed'
              ? 'Claude Code 开发任务已完成'
              : `Claude Code 开发任务结束：${task.status}${task.finalResponse ? `：${task.finalResponse}` : ''}`,
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
        child.stdin.write(String(structuredPrompt));
        child.stdin.end();
      } catch (error) {
        finish(reject, taskError(task, error));
      }
    }).finally(() => {
      this.tasks.delete(taskId);
    });
  }

  claudeEnv() {
    return runtimeConfigToEnv(
      this.runtimeConfig,
      this.auth,
      authToEnv(this.auth),
    );
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
    const detail = resultEventDetail(event);
    if (detail) task.finalResponse = detail;
    return `Claude Code 结束：${event.subtype || 'result'}${detail ? `：${detail}` : ''}`;
  }
  return '';
}

function resultEventDetail(event) {
  const values = [
    event?.result,
    event?.error,
    event?.message,
    ...(Array.isArray(event?.errors) ? event.errors : []),
  ];
  return values
    .map(value => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean)
    .join('；');
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
    selectionLocations: task.selectionLocations || [],
    changedFiles: [...task.changedFiles],
    error: task.error || '',
  };
}

function normalizeStructuredTaskResult(task) {
  applyStructuredTaskResult(task);
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
