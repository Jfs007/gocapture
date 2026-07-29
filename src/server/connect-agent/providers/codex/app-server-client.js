'use strict';

const readline = require('readline');
const crypto = require('crypto');
const path = require('path');
const {
  inspectCodexCli,
  spawnCodexAppServer,
  proxyEnv,
} = require('./cli');
const { loadProjectlessThreadIds } = require('./desktop-state');
const { PRODUCT_NAME } = require('../../../core/product-brand');
const { applyStructuredTaskResult } = require('../../structured-task-result');
const { AgentAdapter } = require('../../core/agent-adapter');
const { MODEL_PROTOCOLS, listModelBackends } = require('../../core/model-backends');
const {
  publicFileDiffs,
  recordUnifiedDiff,
  setTaskFileDiff,
  taskFile,
} = require('../../core/file-diff');

const INITIALIZE_TIMEOUT_MS = 10000;
const REQUEST_TIMEOUT_MS = 20000;
const TASK_TIMEOUT_MS = 30 * 60 * 1000;

class CodexAppServerClient extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'codex',
      name: 'Codex',
      capabilities: {
        proxy: true,
        threadBinding: true,
        requiresThreadBinding: true,
        modelBackendConfiguration: false,
      },
      modelProtocols: [MODEL_PROTOCOLS.OPENAI_RESPONSES],
      // Codex App Server currently owns its model-provider configuration.
      // GoCapture only reports the required wire protocol and does not pretend
      // that an arbitrary endpoint can be injected into an existing process.
      modelBackends: ['inherit'],
    });
    this.inspectCli = options.inspectCli || inspectCodexCli;
    this.spawnAppServer = options.spawnAppServer || spawnCodexAppServer;
    this.now = options.now || (() => new Date());
    this.loadProjectlessThreadIds = options.loadProjectlessThreadIds || loadProjectlessThreadIds;
    this.process = null;
    this.reader = null;
    this.pending = new Map();
    this.subscribers = new Set();
    this.tasks = new Map();
    this.requestId = 0;
    this.state = 'disconnected';
    this.lastError = '';
    this.stderrTail = [];
    this.cli = null;
    this.proxy = '';
  }

  setProxy(proxy) {
    const next = String(proxy || '').trim();
    if (next === this.proxy) return;
    this.proxy = next;
    if (this.process) this.disconnect();
  }

  configureProject(settings = {}) {
    this.setProxy(settings.proxy);
  }

  async inspect() {
    this.cli = await this.inspectCli();
    return this.status();
  }

  async connect() {
    if (this.isConnected()) return this.status();
    if (this.state === 'connecting') {
      throw new Error('Codex 正在连接，请稍后重试。');
    }

    this.state = 'checking';
    this.lastError = '';
    const cli = await this.inspectCli();
    this.cli = cli;
    if (!cli.installed) {
      this.state = 'unavailable';
      throw new Error(cli.message);
    }
    if (!cli.authenticated) {
      this.state = 'login-required';
      throw new Error(cli.message);
    }

    this.state = 'connecting';
    const child = this.spawnAppServer(cli.executable, {
      env: proxyEnv(this.proxy),
    });
    this.process = child;
    this.stderrTail = [];
    this.attachProcess(child);

    try {
      await this.request('initialize', {
        clientInfo: {
          name: 'gocapture',
          title: PRODUCT_NAME,
          version: '1.0.0',
        },
      }, INITIALIZE_TIMEOUT_MS);
      this.notify('initialized', {});
      this.state = 'connected';
      return this.status();
    } catch (error) {
      this.lastError = this.connectionError(error);
      this.state = 'error';
      this.stopProcess();
      throw new Error(this.lastError);
    }
  }

  disconnect() {
    this.stopProcess();
    this.state = 'disconnected';
    this.lastError = '';
    return this.status();
  }

  close() {
    this.stopProcess();
  }

  isConnected() {
    return this.state === 'connected' && !!this.process && !this.process.killed;
  }

  status() {
    return this.publicStatus({
      state: this.isConnected() ? 'connected' : this.state,
      connected: this.isConnected(),
      installed: !!this.cli?.installed,
      authenticated: !!this.cli?.authenticated,
      version: this.cli?.version || '',
      executable: this.cli?.executable || '',
      message: this.statusMessage(),
      error: this.lastError,
      activeTaskCount: this.tasks.size,
      supportsProxy: true,
      proxy: this.proxy,
      availableModelBackends: listModelBackends(this.manifest.modelBackends),
      runtimeConfig: {
        backendId: 'inherit',
        protocol: MODEL_PROTOCOLS.INHERIT,
      },
    });
  }

  async listBindableThreads({ cwd, limit = 30 } = {}) {
    if (!this.isConnected()) await this.connect();
    const projectRoot = path.resolve(String(cwd || '.'));
    const pageSize = Math.max(1, Math.min(Number(limit) || 30, 100));
    const [projectResponse, recentResponse] = await Promise.all([
      this.request('thread/list', {
        cwd: projectRoot,
        limit: pageSize,
        sortKey: 'updated_at',
        sortDirection: 'desc',
        archived: false,
      }, REQUEST_TIMEOUT_MS),
      this.request('thread/list', {
        limit: 100,
        sortKey: 'updated_at',
        sortDirection: 'desc',
        archived: false,
      }, REQUEST_TIMEOUT_MS),
    ]);
    const projectlessIds = this.loadProjectlessThreadIds();
    const project = normalizeThreadList(projectResponse?.data)
      .filter(thread => path.resolve(thread.cwd || '.') === projectRoot)
      .slice(0, pageSize);
    const projectIds = new Set(project.map(thread => thread.id));
    const recent = normalizeThreadList(recentResponse?.data)
      .filter(thread => projectlessIds.has(thread.id) && !projectIds.has(thread.id))
      .slice(0, pageSize);
    return {
      project,
      recent,
      projectlessStateAvailable: projectlessIds.size > 0,
    };
  }

  async readThread(threadId) {
    if (!this.isConnected()) await this.connect();
    const id = String(threadId || '').trim();
    if (!id) throw new Error('缺少 Codex 任务 ID');
    const response = await this.request('thread/read', {
      threadId: id,
      includeTurns: false,
    }, REQUEST_TIMEOUT_MS);
    const [thread] = normalizeThreadList(response?.thread ? [response.thread] : []);
    if (!thread) throw new Error('Codex 任务不存在或无法读取');
    return thread;
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
    if (!cwd) throw new Error('Codex 任务缺少项目目录');
    if (!String(prompt || '').trim()) throw new Error('Codex 任务缺少开发要求');
    if (signal?.aborted) throw new Error('Codex 开发任务已取消');
    if (!this.isConnected()) await this.connect();
    if (signal?.aborted) throw new Error('Codex 开发任务已取消');

    const task = {
      taskId,
      threadId: '',
      turnId: '',
      status: 'starting',
      startedAt: Date.now(),
      finishedAt: 0,
      finalResponse: '',
      agentMessages: [],
      selectionLocations: [],
      cwd,
      changedFiles: new Set(),
      fileDiffs: new Map(),
    };
    this.tasks.set(taskId, task);
    onEvent({
      type: 'task-started',
      task: publicTask(task),
      message: `Codex 开发任务已创建：${taskId}`,
    });

    let unsubscribe = () => {};
    let abortHandler = null;
    try {
      const resumedThreadId = String(threadId || '').trim();
      let threadResult;
      let resumed = false;
      if (resumedThreadId) {
        try {
          threadResult = await this.request('thread/resume', {
            threadId: resumedThreadId,
            cwd,
            approvalPolicy: 'never',
            sandbox: 'workspace-write',
          }, REQUEST_TIMEOUT_MS);
          resumed = true;
        } catch (error) {
          onEvent({
            type: 'thread-resume-failed',
            message: `Codex 项目 Thread 恢复失败，请重新绑定任务：${error.message || error}`,
          });
          throw new Error(`已绑定的 Codex 任务无法恢复，请重新绑定：${error.message || error}`);
        }
      }
      if (!threadResult) {
        threadResult = await this.request('thread/start', {
          cwd,
          approvalPolicy: 'never',
          sandbox: 'workspace-write',
          serviceName: 'gocapture',
          ephemeral: false,
          threadSource: 'user',
        }, REQUEST_TIMEOUT_MS);
      }
      task.threadId = String(threadResult?.thread?.id || '');
      if (!task.threadId) throw new Error(`Codex thread/${resumed ? 'resume' : 'start'} 未返回 threadId`);
      if (!resumed) {
        const threadName = buildThreadName(cwd, this.now());
        try {
          await this.request('thread/name/set', {
            threadId: task.threadId,
            name: threadName,
          }, REQUEST_TIMEOUT_MS);
          onEvent({
            type: 'thread-named',
            task: publicTask(task),
            message: `Codex 对话已命名：${threadName}`,
          });
        } catch (error) {
          onEvent({
            type: 'thread-name-failed',
            task: publicTask(task),
            message: `Codex 对话命名失败：${error.message || error}`,
          });
        }
      }
      task.status = resumed ? 'thread-resumed' : 'thread-started';
      onThread({ threadId: task.threadId, resumed });
      onEvent({
        type: resumed ? 'thread-resumed' : 'thread-started',
        task: publicTask(task),
        message: resumed
          ? `Codex 项目 Thread 已恢复：${task.threadId}`
          : `Codex 项目 Thread 已创建：${task.threadId}`,
      });
      if (signal?.aborted) throw new Error('Codex 开发任务已取消');

      const completed = deferred();
      unsubscribe = this.subscribe(message => {
        if (message.method === 'transport/error') {
          completed.reject(new Error(message.params?.message || 'Codex App Server 连接中断'));
          return;
        }
        if (!belongsToTask(message, task)) return;
        updateTaskFromNotification(task, message);
        onEvent({
          type: 'codex-event',
          task: taskIdentity(task),
          fileDiffs: publicFileDiffs(task),
          event: message,
          message: describeNotification(message),
        });
        if (message.method === 'error' && message.params?.willRetry === false) {
          completed.reject(new Error(
            message.params?.error?.message || 'Codex 开发任务执行失败',
          ));
          return;
        }
        if (message.method === 'turn/completed') completed.resolve(message.params);
      });

      abortHandler = () => {
        if (task.threadId && task.turnId) {
          this.request('turn/interrupt', {
            threadId: task.threadId,
            turnId: task.turnId,
          }, 5000).catch(() => {});
        }
        completed.reject(new Error('Codex 开发任务已取消'));
      };
      signal?.addEventListener?.('abort', abortHandler, { once: true });
      // 先注册再检查，避免 signal 在检查和监听之间取消。
      if (signal?.aborted) abortHandler();

      const turnPrompt = resumed || !String(initialInstructions || '').trim()
        ? String(prompt)
        : `${String(initialInstructions).trim()}\n\n${String(prompt)}`;
      const turnResult = await this.request('turn/start', {
        threadId: task.threadId,
        input: [{ type: 'text', text: turnPrompt }],
        cwd,
        approvalPolicy: 'never',
        sandboxPolicy: {
          type: 'workspaceWrite',
          writableRoots: [cwd],
          networkAccess: false,
        },
        outputSchema,
      }, REQUEST_TIMEOUT_MS);
      task.turnId = String(turnResult?.turn?.id || task.turnId || '');
      if (!task.turnId) throw new Error('Codex turn/start 未返回 turnId');
      // turn/start 请求期间可能发生取消。此时 abortHandler 还拿不到 turnId，
      // 在取得 id 后补发 interrupt，避免后台留下无人接管的 Codex Turn。
      if (signal?.aborted) {
        await this.request('turn/interrupt', {
          threadId: task.threadId,
          turnId: task.turnId,
        }, 5000).catch(() => {});
        throw new Error('Codex 开发任务已取消');
      }
      task.status = 'running';
      onEvent({
        type: 'turn-started',
        task: publicTask(task),
        message: `Codex Turn 已启动：${task.turnId}`,
      });

      const completedParams = await withTimeout(
        completed.promise,
        TASK_TIMEOUT_MS,
        'Codex 开发任务执行超时',
      );
      task.status = turnStatus(completedParams?.turn) || 'completed';
      task.finishedAt = Date.now();
      normalizeStructuredTaskResult(task);
      const result = publicTask(task);
      onEvent({
        type: 'task-completed',
        task: result,
        message: task.status === 'completed' ? 'Codex 开发任务已完成' : `Codex 开发任务结束：${task.status}`,
      });
      return result;
    } catch (error) {
      task.status = signal?.aborted ? 'cancelled' : 'failed';
      task.finishedAt = Date.now();
      task.error = error?.message || String(error);
      throw Object.assign(new Error(task.error), { task: publicTask(task) });
    } finally {
      unsubscribe();
      if (abortHandler) signal?.removeEventListener?.('abort', abortHandler);
      this.tasks.delete(taskId);
    }
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  statusMessage() {
    if (this.isConnected()) return `已连接 Codex${this.cli?.version ? ` ${this.cli.version}` : ''}`;
    if (this.state === 'connecting') return '正在启动 Codex App Server…';
    if (this.state === 'checking') return '正在检查 Codex 环境…';
    if (this.state === 'login-required') return 'Codex CLI 尚未登录';
    if (this.state === 'unavailable') return '未检测到 Codex CLI';
    if (this.state === 'error') return this.lastError || 'Codex 连接失败';
    if (this.cli?.installed && this.cli?.authenticated) return `Codex ${this.cli.version || ''} 可以连接`.trim();
    return this.cli?.message || '尚未连接';
  }

  attachProcess(child) {
    this.reader = readline.createInterface({ input: child.stdout });
    this.reader.on('line', line => this.handleLine(line));
    child.stderr.on('data', chunk => {
      const lines = String(chunk || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      this.stderrTail.push(...lines);
      if (this.stderrTail.length > 12) this.stderrTail.splice(0, this.stderrTail.length - 12);
    });
    child.on('error', error => this.handleExit(error));
    child.on('exit', (code, signal) => {
      if (this.process !== child) return;
      const detail = `Codex App Server 已退出${code != null ? `（退出码 ${code}）` : ''}${signal ? `（${signal}）` : ''}`;
      this.handleExit(new Error(detail));
    });
  }

  handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      return;
    }
    if (message.method && message.id == null) {
      for (const listener of this.subscribers) listener(message);
      return;
    }
    if (message.method && message.id != null) {
      this.rejectServerRequest(message);
      return;
    }
    if (message.id == null) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timeoutId);
    if (message.error) {
      pending.reject(new Error(message.error.message || 'Codex App Server 请求失败'));
      return;
    }
    pending.resolve(message.result);
  }

  rejectServerRequest(message) {
    const method = String(message.method || '');
    if (method === 'item/commandExecution/requestApproval'
      || method === 'item/fileChange/requestApproval') {
      this.write({ id: message.id, result: { decision: 'decline' } });
      return;
    }
    this.write({
      id: message.id,
      error: { code: -32601, message: `${PRODUCT_NAME} 不支持 Codex 服务请求：${method}` },
    });
  }

  handleExit(error) {
    const message = this.connectionError(error);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(message));
    }
    this.pending.clear();
    for (const listener of this.subscribers) {
      listener({ method: 'transport/error', params: { message } });
    }
    this.subscribers.clear();
    this.reader?.close();
    this.reader = null;
    this.process = null;
    if (this.state !== 'disconnected') {
      this.state = 'error';
      this.lastError = message;
    }
  }

  request(method, params, timeoutMs) {
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        reject(new Error('Codex App Server 尚未启动'));
        return;
      }
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex App Server ${method} 超时`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeoutId });
      this.write({ method, id, params });
    });
  }

  notify(method, params) {
    this.write({ method, params });
  }

  write(message) {
    if (!this.process?.stdin?.writable) throw new Error('Codex App Server 连接不可用');
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  stopProcess() {
    const child = this.process;
    this.process = null;
    this.reader?.close();
    this.reader = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Codex App Server 连接已关闭'));
    }
    this.pending.clear();
    for (const listener of this.subscribers) {
      listener({ method: 'transport/error', params: { message: 'Codex App Server 连接已关闭' } });
    }
    this.subscribers.clear();
    if (child && !child.killed) child.kill('SIGTERM');
  }

  connectionError(error) {
    const stderr = this.stderrTail.slice(-4).join('；');
    const message = error?.message || String(error || 'Codex App Server 连接失败');
    return stderr ? `${message}：${stderr}` : message;
  }
}

function buildThreadName(cwd, now = new Date()) {
  const projectName = path.basename(path.resolve(String(cwd || '.'))) || 'project';
  const time = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const date = [
    time.getFullYear(),
    padTimePart(time.getMonth() + 1),
    padTimePart(time.getDate()),
  ].join('-');
  const clock = `${padTimePart(time.getHours())}:${padTimePart(time.getMinutes())}`;
  return `${PRODUCT_NAME} · ${projectName} · ${date} ${clock}`;
}

function normalizeThreadList(value) {
  return (Array.isArray(value) ? value : []).map(thread => ({
    id: String(thread?.id || '').trim(),
    name: String(thread?.name || '').trim(),
    preview: String(thread?.preview || '').trim(),
    cwd: String(thread?.cwd || '').trim(),
    createdAt: Number(thread?.createdAt || 0),
    updatedAt: Number(thread?.updatedAt || 0),
    status: normalizeThreadStatus(thread?.status),
    source: thread?.source || null,
  })).filter(thread => thread.id);
}

function normalizeThreadStatus(status) {
  if (typeof status === 'string') return status;
  if (status && typeof status === 'object') return Object.keys(status)[0] || '';
  return '';
}

function padTimePart(value) {
  return String(value).padStart(2, '0');
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  // deferred 可能先于后续 await 被事件回调拒绝。立即登记 rejection
  // 处理器，避免 Node 将正常的任务取消升级为进程级 unhandled rejection。
  promise.catch(() => {});
  return { promise, resolve, reject };
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      error => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function notificationThreadId(message) {
  return String(message?.params?.threadId || message?.params?.thread?.id || '');
}

function notificationTurnId(message) {
  return String(message?.params?.turnId || message?.params?.turn?.id || '');
}

function belongsToTask(message, task) {
  const threadId = notificationThreadId(message);
  if (threadId && threadId !== task.threadId) return false;
  const turnId = notificationTurnId(message);
  if (task.turnId && turnId && turnId !== task.turnId) return false;
  return !!threadId;
}

function updateTaskFromNotification(task, message) {
  const turnId = notificationTurnId(message);
  if (turnId && !task.turnId) task.turnId = turnId;
  const params = message?.params || {};
  if (message.method === 'turn/diff/updated') {
    recordUnifiedDiff(task, params.diff, 'codex-app-server');
  }
  if (message.method === 'item/agentMessage/delta') {
    task.finalResponse += String(params.delta || '');
  }
  if (message.method === 'item/completed') {
    const item = params.item || {};
    if (item.type === 'agentMessage' && String(item.text || '').trim()) {
      const text = String(item.text || '');
      task.agentMessages.push(text);
      task.finalResponse = text;
    }
    if (item.type === 'fileChange') {
      for (const change of (Array.isArray(item.changes) ? item.changes : [])) {
        const file = taskFile(task, change?.path || change?.file);
        if (file) task.changedFiles.add(file);
        if (file && change?.diff) {
          setTaskFileDiff(task, {
            file,
            patch: change.diff,
            phase: 'applied',
            source: 'codex-app-server',
          });
        }
      }
    }
  }
}

function turnStatus(turn) {
  const status = turn?.status;
  if (typeof status === 'string') return status;
  if (status && typeof status === 'object') return Object.keys(status)[0] || '';
  return '';
}

function normalizeStructuredTaskResult(task) {
  applyStructuredTaskResult(task);
}

function publicTask(task) {
  return {
    taskId: task.taskId,
    threadId: task.threadId,
    turnId: task.turnId,
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

function taskIdentity(task) {
  return {
    taskId: task.taskId,
    threadId: task.threadId,
    turnId: task.turnId,
    status: task.status,
    startedAt: task.startedAt,
  };
}

function describeNotification(message) {
  const method = String(message?.method || '');
  const item = message?.params?.item || {};
  if (method === 'item/started') {
    const description = describeItem(item, false);
    return description ? `Codex 开始：${description}` : '';
  }
  if (method === 'item/completed') {
    const description = describeItem(item, true);
    return description ? `Codex 完成：${description}` : '';
  }
  if (method === 'turn/started') return `Codex Turn 运行中：${notificationTurnId(message)}`;
  if (method === 'turn/completed') return `Codex Turn 已结束：${turnStatus(message?.params?.turn) || 'completed'}`;
  if (method === 'error') {
    const suffix = message?.params?.willRetry ? '（正在重试）' : '';
    return `Codex 错误：${message?.params?.error?.message || '执行失败'}${suffix}`;
  }
  if (method === 'warning') return `Codex 警告：${message?.params?.message || '执行期间出现警告'}`;
  if (/\/(delta|outputDelta|patchUpdated)$/.test(method)) return '';
  return '';
}

function describeItem(item, completed) {
  const type = String(item?.type || 'item');
  if (type === 'userMessage') return '';
  if (type === 'commandExecution') {
    const status = completed && item.exitCode != null ? `；退出码 ${item.exitCode}` : '';
    const output = completed ? truncateLog(item.aggregatedOutput, 1200) : '';
    return `${item.command || '执行命令'}${status}${output ? `\n${output}` : ''}`;
  }
  if (type === 'fileChange') {
    const files = (Array.isArray(item.changes) ? item.changes : [])
      .map(change => change?.path || change?.file)
      .filter(Boolean);
    return files.length ? `修改文件：${files.join('、')}` : '修改文件';
  }
  if (type === 'agentMessage') return '生成回复';
  if (type === 'reasoning') return '分析任务';
  if (type === 'mcpToolCall') return `MCP ${item.server || '-'} / ${item.tool || '-'}`;
  if (type === 'dynamicToolCall') return `工具 ${item.tool || '-'}`;
  if (type === 'webSearch') return `搜索 ${item.query || ''}`.trim();
  return '';
}

function truncateLog(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n…输出已截断`;
}

module.exports = {
  CodexAppServerClient,
  belongsToTask,
  describeNotification,
  updateTaskFromNotification,
};
