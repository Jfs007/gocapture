'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { AgentAdapter } = require('../../core/agent-adapter');
const {
  MODEL_PROTOCOLS,
  assertModelBackendCompatible,
  getModelBackend,
  listModelBackends,
} = require('../../core/model-backends');
const {
  captureProposedFileEdit,
  finalizeTaskFileDiffs,
  publicFileDiffs,
} = require('../../core/file-diff');
const { applyStructuredTaskResult } = require('../../structured-task-result');
const {
  normalizeAuth,
  loadClaudeAuthForBackend,
  listClaudeAuthBackendIds,
  saveClaudeAuth,
  authToEnv,
} = require('./auth-store');
const {
  CLAUDE_MODEL_BACKENDS,
  loadRuntimeConfig,
  loadRuntimeProfiles,
  normalizeRuntimeConfig,
  runtimeConfigToEnv,
  saveRuntimeConfig,
  validateRuntimeConfig,
} = require('./runtime-config');

const TASK_TIMEOUT_MS = 30 * 60 * 1000;
const PROBE_TIMEOUT_MS = 60 * 1000;
const AUTH_FAIL_RE = /API Error:\s*40[13]|Failed to authenticate|not allowed|Invalid API key|api key.*invalid|unauthor/i;
const REGION_BLOCK_RE = /Request not allowed|\b403\b/i;
const HITL_TOOL_NAME = 'AskUserQuestion';
const HITL_TURN_INSTRUCTION = [
  '若继续处理前必须得到用户补充信息，必须调用',
  `${HITL_TOOL_NAME}；不要只在正文中提问后结束任务。`,
].join(' ');
const FILE_EDIT_TOOLS = new Set([
  'Edit',
  'Write',
  'MultiEdit',
  'NotebookEdit',
  'create_file',
  'str_replace_editor',
]);

class ClaudeAgentSdkClient extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'claude',
      name: 'Claude Code',
      capabilities: {
        proxy: true,
        threadBinding: false,
        requiresThreadBinding: false,
        modelBackendConfiguration: true,
        humanInTheLoop: true,
      },
      modelProtocols: [MODEL_PROTOCOLS.ANTHROPIC_MESSAGES],
      modelBackends: CLAUDE_MODEL_BACKENDS,
    });
    this.queryFactory = options.queryFactory || null;
    this.loadSdk = options.loadSdk || (() => import('@anthropic-ai/claude-agent-sdk'));
    this.sdkPromise = null;
    this.sdkVersion = options.sdkVersion || '';
    this.fetch = options.fetch || globalThis.fetch;
    this.permissionMode = options.permissionMode
      || process.env.GOCAPTURE_CLAUDE_PERMISSION_MODE
      || 'bypassPermissions';
    this.model = options.model || process.env.GOCAPTURE_CLAUDE_MODEL || '';
    this.tasks = new Map();
    this.runners = new Map();
    this.sessions = new Map();
    this.state = 'disconnected';
    this.lastError = '';
    this.runtimeConfig = normalizeRuntimeConfig(
      options.runtimeConfig || (options.loadRuntimeConfig || loadRuntimeConfig)(),
    );
    this.loadRuntimeProfiles = options.loadRuntimeProfiles
      || (options.loadRuntimeConfig
        ? () => ({ [this.runtimeConfig.backendId]: { ...this.runtimeConfig } })
        : loadRuntimeProfiles);
    this.saveRuntimeConfig = options.saveRuntimeConfig || saveRuntimeConfig;
    this.loadAuthForBackend = options.loadAuthForBackend || loadClaudeAuthForBackend;
    this.listAuthBackendIds = options.listAuthBackendIds || listClaudeAuthBackendIds;
    this.auth = options.auth
      ? normalizeAuth({
        ...options.auth,
        backendId: options.auth.backendId || this.runtimeConfig.backendId,
      })
      : this.loadAuthForBackend(this.runtimeConfig.backendId);
    this.saveAuth = options.saveAuth || saveClaudeAuth;
  }

  configureProject(settings = {}) {
    this.setProxy(settings.proxy);
  }

  setProxy(proxy) {
    const next = String(proxy || '').trim();
    if (next === this.auth.proxy) return;
    this.auth = normalizeAuth({ ...this.auth, proxy: next });
    if (this.runners.size) this.stopAllTasks('Claude Agent SDK 代理配置已更新');
  }

  async sdk() {
    if (!this.sdkPromise) this.sdkPromise = Promise.resolve().then(() => this.loadSdk());
    return this.sdkPromise;
  }

  async createQuery(params) {
    if (this.queryFactory) return this.queryFactory(params);
    const sdk = await this.sdk();
    return sdk.query(params);
  }

  async inspect() {
    try {
      await this.sdk();
      this.sdkVersion = this.sdkVersion || installedSdkVersion();
      if (this.state === 'unavailable') this.state = 'disconnected';
      this.lastError = '';
    } catch (error) {
      this.state = 'unavailable';
      this.lastError = `Claude Agent SDK 不可用：${error.message}`;
    }
    return this.status();
  }

  async connect(options = {}) {
    this.state = 'checking';
    this.lastError = '';
    const previousAuth = this.auth;
    const previousRuntimeConfig = this.runtimeConfig;
    const hasAuthUpdate = !!options.auth;
    const hasRuntimeUpdate = !!options.runtimeConfig;

    if (hasRuntimeUpdate) {
      this.runtimeConfig = normalizeRuntimeConfig(options.runtimeConfig);
      if (!hasAuthUpdate) this.auth = this.loadAuthForBackend(this.runtimeConfig.backendId);
    }
    if (hasAuthUpdate) {
      this.auth = normalizeAuth({
        ...options.auth,
        backendId: options.auth.backendId || this.runtimeConfig.backendId,
      });
    }

    try {
      const configError = validateRuntimeConfig(this.runtimeConfig, this.manifest);
      if (configError) throw new Error(configError);
      assertModelBackendCompatible(this.manifest, this.runtimeConfig.backendId);
      await this.sdk();
      this.sdkVersion = this.sdkVersion || installedSdkVersion();

      const probe = this.runtimeConfig.backendId !== 'inherit'
        && this.runtimeConfig.backendId !== 'anthropic'
        && !this.auth.proxy
        ? await this.probeAnthropicCompatibleApi()
        : await this.probeAuth();
      if (!probe.ok) throw new Error(probe.message);

      if (hasAuthUpdate && !this.saveAuth(this.auth)) {
        throw new Error('Claude Code 授权配置保存失败');
      }
      if (hasRuntimeUpdate && !this.saveRuntimeConfig(this.runtimeConfig)) {
        throw new Error('Claude Code 运行模型配置保存失败');
      }
      if ((hasAuthUpdate || hasRuntimeUpdate) && this.runners.size) {
        this.stopAllTasks('Claude Agent SDK 连接配置已更新');
      }
      this.state = 'connected';
      return this.status();
    } catch (error) {
      if (hasAuthUpdate) this.auth = previousAuth;
      if (hasRuntimeUpdate) this.runtimeConfig = previousRuntimeConfig;
      this.state = this.state === 'unavailable' ? 'unavailable' : 'error';
      this.lastError = error.message;
      throw error;
    }
  }

  async probeAnthropicCompatibleApi() {
    const backend = getModelBackend(this.runtimeConfig.backendId);
    const backendName = backend?.name || '模型后端';
    if (this.auth.mode !== 'apikey' || !this.auth.apiKey) {
      return { ok: false, message: `${backendName} 连接缺少 API Key` };
    }
    if (typeof this.fetch !== 'function') return this.probeAuth();

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
          model: this.runtimeConfig.fastModel || this.runtimeConfig.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'OK' }],
        }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) return { ok: true, message: '' };
      const detail = String(body?.error?.message || body?.message || `HTTP ${response.status}`);
      return {
        ok: false,
        message: response.status === 401 || response.status === 403
          ? `${backendName} 授权失败：${detail}`
          : `${backendName} API 验证失败：${detail}`,
      };
    } catch (error) {
      return {
        ok: false,
        message: error?.name === 'AbortError'
          ? `${backendName} API 验证超时（15s），请检查网络或代理`
          : `${backendName} API 验证失败：${error.message}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async probeAuth() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    let queryHandle;
    let detail = '';
    try {
      queryHandle = await this.createQuery({
        prompt: '只回复 OK。',
        options: {
          abortController: controller,
          cwd: process.cwd(),
          env: this.claudeEnv(),
          model: this.runtimeConfig.fastModel || this.runtimeConfig.model || this.model || undefined,
          permissionMode: 'dontAsk',
          persistSession: false,
          settingSources: ['user', 'project', 'local'],
          tools: [],
          maxTurns: 1,
        },
      });
      for await (const event of queryHandle) {
        if (event?.type !== 'result') continue;
        detail = resultEventDetail(event);
        if (!event.is_error && event.subtype === 'success' && !AUTH_FAIL_RE.test(detail)) {
          return { ok: true, message: '' };
        }
        break;
      }
      return {
        ok: false,
        message: `${explainProbeFailure(detail, this.runtimeConfig.backendId)}${detail ? `：${detail.slice(0, 200)}` : ''}`,
      };
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        return { ok: false, message: '授权验证超时（60s），请检查网络或登录状态。' };
      }
      return { ok: false, message: `授权验证失败：${error.message}` };
    } finally {
      clearTimeout(timer);
      queryHandle?.close?.();
    }
  }

  disconnect() {
    this.stopAllTasks('Claude Agent SDK 连接已断开');
    this.state = 'disconnected';
    this.lastError = '';
    return this.status();
  }

  close() {
    this.stopAllTasks('Claude Agent SDK 服务已关闭');
  }

  isConnected() {
    return this.state === 'connected';
  }

  status() {
    const available = !!this.queryFactory || !!this.sdkVersion || this.state !== 'unavailable';
    return this.publicStatus({
      state: this.isConnected() ? 'connected' : this.state,
      connected: this.isConnected(),
      installed: available,
      authenticated: !!this.auth.mode || this.runtimeConfig.backendId === 'inherit',
      version: this.sdkVersion,
      executable: '',
      message: this.statusMessage(),
      error: this.lastError,
      activeTaskCount: this.tasks.size,
      warmRuntimeCount: [...this.runners.values()].filter(runner => !!runner.query).length,
      authModes: ['subscription', 'apikey'],
      authMode: this.auth.mode || '',
      authBackendId: this.auth.backendId || '',
      authBackendIds: this.listAuthBackendIds(),
      authConfigured: !!this.auth.mode,
      supportsProxy: true,
      proxy: this.auth.proxy || '',
      supportsRuntimeConfig: true,
      runtimeConfig: { ...this.runtimeConfig },
      runtimeProfiles: this.loadRuntimeProfiles(),
      availableModelBackends: listModelBackends(this.manifest.modelBackends),
    });
  }

  statusMessage() {
    if (this.isConnected()) {
      return `已连接 Claude Agent SDK${this.sdkVersion ? ` ${this.sdkVersion}` : ''}`;
    }
    if (this.state === 'checking') return '正在验证 Claude Agent SDK…';
    if (this.state === 'unavailable') return this.lastError || 'Claude Agent SDK 不可用';
    if (this.state === 'error') return this.lastError || 'Claude Agent SDK 连接失败';
    return 'Claude Agent SDK 可以连接';
  }

  async runTask({
    taskId = `task_${crypto.randomUUID().replace(/-/g, '')}`,
    cwd,
    prompt,
    initialInstructions = '',
    outputSchema,
    threadId = '',
    onThread = () => {},
    onEvent = () => {},
    signal,
  }) {
    if (!cwd) throw new Error('Claude Agent SDK 任务缺少项目目录');
    if (!String(prompt || '').trim()) throw new Error('Claude Agent SDK 任务缺少开发要求');
    if (!this.isConnected()) await this.connect();

    const runner = this.projectRunner(cwd);
    const requestedSessionId = String(threadId || this.sessions.get(cwd) || '').trim();
    if (!runner.active && runner.query && requestedSessionId && runner.sessionId !== requestedSessionId) {
      this.resetRunner(runner);
    }
    if (!runner.query && requestedSessionId) {
      runner.sessionId = requestedSessionId;
      runner.instructionsSent = true;
    }

    const task = {
      taskId,
      sessionId: runner.sessionId || requestedSessionId,
      status: 'queued',
      startedAt: Date.now(),
      finishedAt: 0,
      finalResponse: '',
      selectionLocations: [],
      cwd,
      changedFiles: new Set(),
      fileBaselines: new Map(),
      fileDiffs: new Map(),
      error: '',
    };
    onEvent({
      type: 'task-started',
      task: publicTask(task),
      message: `Claude Code 开发任务已创建：${taskId}`,
    });

    return new Promise((resolve, reject) => {
      const entry = {
        task,
        prompt: String(prompt),
        initialInstructions: String(initialInstructions || '').trim(),
        outputSchema,
        requestedSessionId,
        onThread,
        onEvent,
        signal,
        resolve,
        reject,
        settled: false,
        persistedSessionId: '',
        timeoutId: null,
        onAbort: null,
        interactions: new Map(),
      };
      entry.onAbort = () => this.cancelEntry(runner, entry);
      if (signal?.aborted) {
        task.status = 'cancelled';
        reject(taskError(task, new Error('Claude Code 开发任务已取消')));
        return;
      }
      signal?.addEventListener?.('abort', entry.onAbort, { once: true });
      this.tasks.set(taskId, entry);
      runner.pending.push(entry);
      void this.pumpRunner(runner);
    });
  }

  projectRunner(cwd) {
    let runner = this.runners.get(cwd);
    if (!runner) {
      runner = {
        cwd,
        query: null,
        input: null,
        reader: null,
        generation: 0,
        active: null,
        pending: [],
        sessionId: String(this.sessions.get(cwd) || ''),
        instructionsSent: !!this.sessions.get(cwd),
      };
      this.runners.set(cwd, runner);
    }
    return runner;
  }

  async ensureRunner(runner) {
    if (runner.query) return false;
    const input = new AsyncMessageQueue();
    const generation = runner.generation + 1;
    runner.generation = generation;
    const queryHandle = await this.createQuery({
      prompt: input,
      options: this.queryOptions(runner),
    });
    runner.input = input;
    runner.query = queryHandle;
    runner.reader = this.consumeRunner(runner, queryHandle, generation);
    return true;
  }

  queryOptions(runner) {
    const model = this.runtimeConfig.model || this.model || undefined;
    return {
      cwd: runner.cwd,
      env: this.claudeEnv(),
      model,
      resume: runner.sessionId || undefined,
      permissionMode: this.permissionMode,
      allowDangerouslySkipPermissions: this.permissionMode === 'bypassPermissions',
      persistSession: true,
      settingSources: ['user', 'project', 'local'],
      tools: { type: 'preset', preset: 'claude_code' },
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: [
          'When required information is missing and the task cannot continue safely,',
          'use the AskUserQuestion tool and wait for the answer.',
          'Do not end the turn with only a prose question when an answer is required.',
        ].join(' '),
      },
      canUseTool: (toolName, input, options) => this.handleToolInteraction(
        runner,
        toolName,
        input,
        options,
      ),
      includePartialMessages: false,
      promptSuggestions: false,
      effort: this.runtimeConfig.effort || undefined,
    };
  }

  async handleToolInteraction(runner, toolName, input = {}, options = {}) {
    const entry = runner.active;
    if (!entry || entry.settled) {
      return {
        behavior: 'deny',
        message: 'GoCapture task is no longer active.',
        toolUseID: options.toolUseID,
      };
    }
    if (toolName === 'AskUserQuestion') {
      const interaction = await this.requestInteraction(entry, {
        kind: 'question',
        toolName,
        toolUseID: options.toolUseID,
        title: options.title || 'Agent 需要补充信息',
        description: options.description || '',
        questions: normalizeQuestions(input.questions),
      }, options.signal);
      return {
        behavior: 'allow',
        updatedInput: {
          ...input,
          answers: answersForQuestions(input.questions, interaction.answer, interaction.answers),
        },
        toolUseID: options.toolUseID,
      };
    }
    if (this.permissionMode === 'bypassPermissions') {
      return {
        behavior: 'allow',
        updatedInput: input,
        toolUseID: options.toolUseID,
      };
    }
    const interaction = await this.requestInteraction(entry, {
      kind: 'permission',
      toolName,
      toolUseID: options.toolUseID,
      title: options.title || `${toolName} 需要确认`,
      description: options.description || options.decisionReason || '',
      input,
    }, options.signal);
    if (interaction.decision === 'allow') {
      return {
        behavior: 'allow',
        updatedInput: input,
        updatedPermissions: interaction.alwaysAllow ? options.suggestions : undefined,
        toolUseID: options.toolUseID,
      };
    }
    return {
      behavior: 'deny',
      message: interaction.message || '用户拒绝了该操作。',
      toolUseID: options.toolUseID,
    };
  }

  requestInteraction(entry, detail, signal) {
    const interactionId = `interaction_${crypto.randomUUID().replace(/-/g, '')}`;
    const interaction = {
      interactionId,
      taskId: entry.task.taskId,
      ...detail,
    };
    entry.task.status = 'waiting-input';
    entry.onEvent({
      type: 'interaction-required',
      task: publicTask(entry.task),
      interaction,
      message: detail.kind === 'question'
        ? `Claude Code 等待回答：${detail.questions[0]?.question || detail.title}`
        : `Claude Code 等待授权：${detail.title}`,
    });
    return new Promise((resolve, reject) => {
      const abort = () => {
        entry.interactions.delete(interactionId);
        reject(new Error('Agent 用户交互已取消'));
      };
      entry.interactions.set(interactionId, {
        interaction,
        resolve: value => {
          signal?.removeEventListener?.('abort', abort);
          resolve(value);
        },
        reject: error => {
          signal?.removeEventListener?.('abort', abort);
          reject(error);
        },
      });
      signal?.addEventListener?.('abort', abort, { once: true });
    });
  }

  async respondToInteraction({ taskId, interactionId, response }) {
    const entry = this.tasks.get(String(taskId || ''));
    const pending = entry?.interactions.get(String(interactionId || ''));
    if (!entry || !pending) throw new Error('该 Agent 交互已结束或不存在');
    entry.interactions.delete(pending.interaction.interactionId);
    entry.task.status = 'running';
    const normalized = normalizeInteractionResponse(response);
    pending.resolve(normalized);
    entry.onEvent({
      type: 'interaction-resolved',
      task: publicTask(entry.task),
      interaction: pending.interaction,
      message: '用户已回答，Claude Code 继续执行',
    });
    return {
      taskId: entry.task.taskId,
      interactionId: pending.interaction.interactionId,
      status: 'running',
    };
  }

  async pumpRunner(runner) {
    if (runner.active || !runner.pending.length) return;
    const entry = runner.pending.shift();
    runner.active = entry;
    entry.task.status = 'starting';
    entry.timeoutId = setTimeout(() => {
      entry.task.status = 'failed';
      this.finishEntry(
        runner,
        entry,
        entry.reject,
        taskError(entry.task, new Error('Claude Code 开发任务执行超时')),
      );
      this.resetRunner(runner);
      void this.pumpRunner(runner);
    }, TASK_TIMEOUT_MS);

    try {
      const started = await this.ensureRunner(runner);
      entry.onEvent({
        type: started ? 'runtime-started' : 'runtime-reused',
        task: publicTask(entry.task),
        message: started
          ? `Claude Agent SDK 项目运行时已启动${runner.sessionId ? '，并恢复已有会话' : ''}`
          : 'Claude Agent SDK 已复用项目运行时',
      });
      entry.onEvent({
        type: 'hitl-ready',
        task: publicTask(entry.task),
        message: `Claude HITL 已启用：需要补充信息时调用 ${HITL_TOOL_NAME}`,
      });
      runner.input.push(userMessage(buildTaskPrompt(runner, entry)));
    } catch (error) {
      entry.task.status = 'failed';
      this.finishEntry(runner, entry, entry.reject, taskError(entry.task, error));
      this.resetRunner(runner);
      void this.pumpRunner(runner);
    }
  }

  async consumeRunner(runner, queryHandle, generation) {
    try {
      for await (const event of queryHandle) {
        if (runner.query !== queryHandle || runner.generation !== generation) return;
        this.handleSdkEvent(runner, event);
      }
      if (runner.query === queryHandle) {
        this.handleRunnerFailure(runner, queryHandle, new Error('Claude Agent SDK 消息流已结束'));
      }
    } catch (error) {
      this.handleRunnerFailure(runner, queryHandle, error);
    }
  }

  handleSdkEvent(runner, event) {
    const entry = runner.active;
    if (!entry) return;
    const { task } = entry;
    const description = updateTaskFromEvent(task, event, FILE_EDIT_TOOLS);
    const isSessionInit = event?.type === 'system' && event?.subtype === 'init';
    if (task.sessionId && (runner.sessionId || isSessionInit || event?.type === 'result')) {
      runner.sessionId = task.sessionId;
      this.sessions.set(runner.cwd, task.sessionId);
      if (task.sessionId !== entry.persistedSessionId) {
        entry.persistedSessionId = task.sessionId;
        entry.onThread({
          threadId: task.sessionId,
          resumed: !!entry.requestedSessionId && task.sessionId === entry.requestedSessionId,
        });
      }
    }
    entry.onEvent({
      type: 'agent-event',
      task: publicTask(task),
      event,
      message: description,
    });
    if (event?.type !== 'result') return;

    task.status = event.subtype === 'success' && !event.is_error
      ? 'completed'
      : String(event.subtype || 'failed');
    task.finishedAt = Date.now();
    finalizeTaskFileDiffs(task, 'claude-agent-sdk');
    applyStructuredTaskResult(task);
    const result = publicTask(task);
    entry.onEvent({
      type: 'task-completed',
      task: result,
      message: task.status === 'completed'
        ? 'Claude Code 开发任务已完成'
        : `Claude Code 开发任务结束：${task.status}${task.finalResponse ? `：${task.finalResponse}` : ''}`,
    });
    if (event.is_error || event.subtype !== 'success') {
      this.finishEntry(
        runner,
        entry,
        entry.reject,
        taskError(task, new Error(task.finalResponse || 'Claude Code 开发任务执行失败')),
      );
    } else {
      this.finishEntry(runner, entry, entry.resolve, result);
    }
    void this.pumpRunner(runner);
  }

  handleRunnerFailure(runner, queryHandle, error) {
    if (runner.query !== queryHandle) return;
    runner.query = null;
    runner.input = null;
    runner.reader = null;
    runner.generation += 1;
    if (!runner.sessionId) runner.instructionsSent = false;
    if (runner.active) {
      const entry = runner.active;
      entry.task.status = entry.task.status === 'cancelled' ? 'cancelled' : 'failed';
      this.finishEntry(runner, entry, entry.reject, taskError(entry.task, error));
    }
    void this.pumpRunner(runner);
  }

  finishEntry(runner, entry, finish, value) {
    if (entry.settled) return;
    entry.settled = true;
    rejectInteractions(entry, new Error('Agent 任务已结束'));
    clearTimeout(entry.timeoutId);
    entry.signal?.removeEventListener?.('abort', entry.onAbort);
    this.tasks.delete(entry.task.taskId);
    if (runner.active === entry) runner.active = null;
    finish(value);
  }

  cancelEntry(runner, entry) {
    if (entry.settled) return;
    entry.task.status = 'cancelled';
    if (runner.active === entry) {
      this.finishEntry(
        runner,
        entry,
        entry.reject,
        taskError(entry.task, new Error('Claude Code 开发任务已取消')),
      );
      this.resetRunner(runner);
      void this.pumpRunner(runner);
      return;
    }
    const index = runner.pending.indexOf(entry);
    if (index >= 0) runner.pending.splice(index, 1);
    this.finishEntry(
      runner,
      entry,
      entry.reject,
      taskError(entry.task, new Error('Claude Code 开发任务已取消')),
    );
  }

  resetRunner(runner) {
    const queryHandle = runner.query;
    const input = runner.input;
    runner.query = null;
    runner.input = null;
    runner.reader = null;
    runner.generation += 1;
    input?.end();
    queryHandle?.close?.();
    if (!runner.sessionId) runner.instructionsSent = false;
  }

  claudeEnv() {
    return {
      ...runtimeConfigToEnv(
        this.runtimeConfig,
        this.auth,
        authToEnv(this.auth),
      ),
      CLAUDE_AGENT_SDK_CLIENT_APP: 'gocapture',
    };
  }

  stopAllTasks(reason) {
    for (const runner of this.runners.values()) {
      const entries = [runner.active, ...runner.pending].filter(Boolean);
      runner.pending = [];
      for (const entry of entries) {
        entry.task.status = 'cancelled';
        entry.task.error = entry.task.error || reason;
        this.finishEntry(
          runner,
          entry,
          entry.reject,
          taskError(entry.task, new Error(reason)),
        );
      }
      this.resetRunner(runner);
    }
    this.runners.clear();
  }
}

class AsyncMessageQueue {
  constructor() {
    this.items = [];
    this.waiters = [];
    this.closed = false;
  }

  push(value) {
    if (this.closed) throw new Error('Claude Agent SDK 输入流已关闭');
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value, done: false });
    else this.items.push(value);
  }

  end() {
    if (this.closed) return;
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) waiter({ value: undefined, done: true });
  }

  next() {
    if (this.items.length) return Promise.resolve({ value: this.items.shift(), done: false });
    if (this.closed) return Promise.resolve({ value: undefined, done: true });
    return new Promise(resolve => this.waiters.push(resolve));
  }

  [Symbol.asyncIterator]() {
    return this;
  }
}

function userMessage(prompt) {
  return {
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'text', text: String(prompt || '') }],
    },
    parent_tool_use_id: null,
  };
}

function buildTaskPrompt(runner, entry) {
  let prompt = `${HITL_TURN_INSTRUCTION}\n\n${entry.prompt}`;
  if (!runner.instructionsSent && entry.initialInstructions) {
    prompt = `${entry.initialInstructions}\n\n${prompt}`;
    runner.instructionsSent = true;
  }
  if (entry.outputSchema) {
    prompt = `${prompt}\n\n最终只返回符合以下 JSON Schema 的 JSON：\n${JSON.stringify(entry.outputSchema)}`;
  }
  return prompt;
}

function normalizeQuestions(questions) {
  return (Array.isArray(questions) ? questions : []).map(question => ({
    question: String(question?.question || '').trim(),
    header: String(question?.header || '').trim(),
    multiSelect: !!question?.multiSelect,
    options: (Array.isArray(question?.options) ? question.options : []).map(option => ({
      label: String(option?.label || '').trim(),
      description: String(option?.description || '').trim(),
      ...(option?.preview ? { preview: String(option.preview) } : {}),
    })),
  })).filter(question => question.question);
}

function answersForQuestions(questions, answer, suppliedAnswers) {
  const normalized = suppliedAnswers && typeof suppliedAnswers === 'object'
    ? Object.fromEntries(Object.entries(suppliedAnswers)
      .map(([question, value]) => [String(question), String(value || '').trim()])
      .filter(([, value]) => value))
    : {};
  if (Object.keys(normalized).length) return normalized;
  const firstQuestion = normalizeQuestions(questions)[0]?.question;
  return firstQuestion ? { [firstQuestion]: String(answer || '').trim() } : {};
}

function normalizeInteractionResponse(response) {
  if (typeof response === 'string') return { answer: response.trim(), decision: 'allow' };
  return {
    answer: String(response?.answer || '').trim(),
    answers: response?.answers && typeof response.answers === 'object'
      ? response.answers
      : undefined,
    decision: response?.decision === 'deny' ? 'deny' : 'allow',
    message: String(response?.message || '').trim(),
    alwaysAllow: !!response?.alwaysAllow,
  };
}

function rejectInteractions(entry, error) {
  for (const pending of entry.interactions?.values?.() || []) pending.reject(error);
  entry.interactions?.clear?.();
}

function updateTaskFromEvent(task, event, fileEditTools = FILE_EDIT_TOOLS) {
  const type = String(event?.type || '');
  if (event?.session_id) task.sessionId = String(event.session_id);

  if (type === 'system' && event.subtype === 'init') {
    task.status = 'running';
    return `Claude Code 会话已启动${task.sessionId ? `：${task.sessionId}` : ''}`;
  }
  if (type === 'assistant') {
    if (task.status === 'starting') task.status = 'running';
    const blocks = Array.isArray(event?.message?.content) ? event.message.content : [];
    const notes = [];
    for (const block of blocks) {
      if (block?.type === 'text' && String(block.text || '').trim()) {
        task.finalResponse = String(block.text);
        notes.push('生成回复');
      }
      if (block?.type !== 'tool_use') continue;
      const tool = String(block.name || '工具');
      const file = String(
        block?.input?.file_path
        || block?.input?.path
        || block?.input?.notebook_path
        || '',
      );
      if (fileEditTools.has(tool) && file) {
        captureProposedFileEdit(task, tool, block.input || {});
      }
      notes.push(describeToolUse(tool, block.input || {}, file));
    }
    return notes.filter(Boolean).map(note => `Claude 使用：${note}`).join('\n');
  }
  if (type === 'result') {
    const detail = event.structured_output != null
      ? JSON.stringify(event.structured_output)
      : resultEventDetail(event);
    if (detail) task.finalResponse = detail;
    return `Claude Code 结束：${event.subtype || 'result'}${detail ? `：${detail}` : ''}`;
  }
  return '';
}

function resultEventDetail(event) {
  return [
    event?.result,
    event?.error,
    event?.message,
    ...(Array.isArray(event?.errors) ? event.errors : []),
  ]
    .map(value => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean)
    .join('；');
}

function describeToolUse(tool, input, file) {
  if (tool === 'Bash') {
    return `执行命令 ${String(input.command || '').slice(0, 120)}`.trim();
  }
  if (file) return `${tool} ${file}`;
  if (tool === 'Read' || tool === 'Grep' || tool === 'Glob') {
    return `${tool} ${String(input.pattern || input.file_path || input.path || '')}`.trim();
  }
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
    fileDiffs: publicFileDiffs(task),
    error: task.error || '',
  };
}

function taskError(task, error) {
  task.error = error?.message || String(error);
  task.finishedAt = task.finishedAt || Date.now();
  return Object.assign(new Error(task.error), { task: publicTask(task) });
}

function explainProbeFailure(text, provider = 'anthropic') {
  const serviceName = getModelBackend(provider)?.name || 'Anthropic';
  if (REGION_BLOCK_RE.test(text)) {
    return `请求受限：当前环境无法连接 ${serviceName}。请检查 Endpoint、账户权限或代理`;
  }
  if (/Invalid API key|Failed to authenticate|unauthor|\b401\b/i.test(text)) {
    return provider !== 'anthropic'
      ? `${serviceName} 授权无效：请检查 API Key 与 Anthropic Messages 兼容 Endpoint`
      : '授权无效：请检查 Anthropic API Key 或 Claude 订阅登录状态';
  }
  return '授权验证失败';
}

function installedSdkVersion() {
  try {
    const entry = require.resolve('@anthropic-ai/claude-agent-sdk');
    const packageFile = path.join(path.dirname(entry), 'package.json');
    return String(JSON.parse(fs.readFileSync(packageFile, 'utf8')).version || '');
  } catch (error) {
    return '';
  }
}

module.exports = {
  AsyncMessageQueue,
  ClaudeAgentSdkClient,
  buildTaskPrompt,
  describeToolUse,
  updateTaskFromEvent,
  userMessage,
};
