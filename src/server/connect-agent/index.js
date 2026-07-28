'use strict';

const crypto = require('crypto');
const { normalizeAgentEvent } = require('./core/agent-event');
const { createDefaultAgentRegistry } = require('./providers');
const { appendProjectMessage } = require('./message-store');
const {
  buildConnectAgentInputLog,
  buildConnectAgentTaskPrompt,
  connectAgentInitialInstructions,
  connectAgentOutputSchema,
} = require('./task-prompt');
const {
  persistLocatedSelectionReferences,
  updateProjectSelectionLocations,
} = require('./selection-reference-store');
const {
  clearProjectAgentSession,
  loadProjectAgentSession,
  saveProjectAgentSession,
} = require('./project-session-store');
const { loadProjectAgentSettings } = require('./project-settings');

function createConnectAgentService(options = {}) {
  const registry = options.registry || createDefaultAgentRegistry();

  function requireProvider(providerId) {
    return registry.require(providerId);
  }

  function configureProviderForProject(provider, project) {
    const settings = loadProjectAgentSettings(project);
    provider.configureProject?.(settings, project);
    return settings;
  }

  return {
    async list({ refresh = false } = {}) {
      if (refresh) {
        await Promise.all(registry.values().map(provider => provider.inspect()));
      }
      return registry.values().map(provider => provider.status());
    },
    async inspect(providerId) {
      return requireProvider(providerId).inspect();
    },
    projectSession(providerId, project) {
      return loadProjectAgentSession(project, providerId);
    },
    async listBindableThreads(providerId, project) {
      const provider = requireProvider(providerId);
      provider.requireCapability('threadBinding', '绑定已有任务');
      return provider.listBindableThreads({ cwd: project.path });
    },
    async bindProjectThread(providerId, project, threadId) {
      const provider = requireProvider(providerId);
      configureProviderForProject(provider, project);
      provider.requireCapability('threadBinding', '绑定已有任务');
      const available = await provider.listBindableThreads({ cwd: project.path });
      const candidates = [...available.project, ...available.recent];
      const selected = candidates.find(thread => thread.id === String(threadId || '').trim());
      if (!selected) {
        throw new Error(`该 ${provider.manifest.name} 任务不属于当前项目或“最近”列表`);
      }
      await provider.readThread(selected.id);
      return saveProjectAgentSession(project, providerId, {
        threadId: selected.id,
        threadName: selected.name || selected.preview,
        source: available.project.some(thread => thread.id === selected.id)
          ? 'project'
          : 'recent',
      });
    },
    async connect(providerId, options = {}, project = null) {
      const provider = requireProvider(providerId);
      if (project) configureProviderForProject(provider, project);
      return provider.connect(options);
    },
    disconnect(providerId) {
      return requireProvider(providerId).disconnect();
    },
    async runTask(providerId, input) {
      const provider = requireProvider(providerId);
      configureProviderForProject(provider, input.project);
      const taskId = String(input.taskId || `task_${crypto.randomUUID().replace(/-/g, '')}`);
      if (input.newThread) clearProjectAgentSession(input.project, providerId);
      const storedSession = input.newThread
        ? null
        : loadProjectAgentSession(input.project, providerId);
      if (provider.supports('requiresThreadBinding') && !storedSession?.threadId) {
        throw new Error(
          `当前项目尚未绑定 ${provider.manifest.name} 任务，`
          + '请先选择项目任务或“最近”中的任务。',
        );
      }
      const persistMessage = message => {
        try {
          return appendProjectMessage(input.project, providerId, {
            taskId,
            threadId: message.threadId || storedSession?.threadId || '',
            ...message,
          });
        } catch (error) {
          input.onEvent?.({
            type: 'message-persist-failed',
            message: `Agent 消息保存失败：${error.message || error}`,
          });
          return null;
        }
      };
      const emitTimelineMessage = timelineMessage => {
        if (!timelineMessage) return;
        input.onEvent?.({
          type: 'timeline-message',
          timelineMessage,
        });
      };
      const emitProviderEvent = event => {
        const text = String(event?.message || '').trim();
        let timelineMessage = null;
        if (text) {
          timelineMessage = persistMessage({
            threadId: event?.task?.threadId || '',
            turnId: event?.task?.turnId || '',
            role: 'system',
            kind: 'event',
            text,
            status: event?.task?.status || '',
            metadata: {
              eventType: String(event?.rawType || event?.type || ''),
              method: String(event?.event?.method || ''),
            },
          });
        }
        input.onEvent?.({
          ...event,
          timelineMessage,
        });
      };
      const userMessage = persistMessage({
        role: 'user',
        kind: 'request',
        text: String(input.userInstruction || '').trim(),
        status: 'submitted',
        metadata: {
          pageUrl: String(input.pageUrl || ''),
          selectionIds: selectionIds(input),
        },
      });
      emitTimelineMessage(userMessage);
      const stagedSelectionIds = persistLocatedSelectionReferences(input.project, input);
      const prompt = buildConnectAgentTaskPrompt({
        ...input,
      });
      const initialInstructions = connectAgentInitialInstructions();
      if (stagedSelectionIds.length) {
        emitProviderEvent({
          type: 'selection-references-staged',
          message: `选区位置已写入：${stagedSelectionIds
            .map(selectionId => `.gocapture/selections/${selectionId}.json`)
            .join('、')}`,
        });
      }
      const outputSchema = connectAgentOutputSchema(
        input.selectionBindings,
        input.locatorEvidence,
      );
      const promptContextMessage = persistMessage({
        role: 'system',
        kind: 'prompt-context',
        text: buildConnectAgentInputLog({
          providerId,
          projectRoot: input.project.path,
          threadId: storedSession?.threadId || '',
          prompt,
          initialInstructions: storedSession?.threadId ? '' : initialInstructions,
          outputSchema,
        }),
        status: 'prepared',
        metadata: {
          mode: input.locatorEvidence ? 'runtime-evidence' : 'located-source',
          promptChars: prompt.length,
          reusedThread: !!storedSession?.threadId,
        },
      });
      emitTimelineMessage(promptContextMessage);
      emitProviderEvent({
        type: 'prompt-ready',
        message: `Agent 输入已准备：${input.locatorEvidence ? '运行时事实模式' : '精确位置模式'}；${prompt.length} 字符`,
      });
      const persistThread = thread => {
        if (!thread?.threadId) return;
        try {
          saveProjectAgentSession(input.project, providerId, thread);
        } catch (error) {
          emitProviderEvent({
            type: 'thread-persist-failed',
            message: `Agent 项目会话保存失败：${error.message || error}`,
          });
        }
      };
      let result;
      try {
        result = await provider.runTask({
          taskId,
          cwd: input.project.path,
          prompt,
          initialInstructions,
          outputSchema,
          threadId: storedSession?.threadId || '',
          onThread: persistThread,
          onEvent: event => emitProviderEvent(normalizeAgentEvent(provider, event)),
          signal: input.signal,
        });
      } catch (error) {
        const errorMessage = persistMessage({
          threadId: error?.task?.threadId || '',
          turnId: error?.task?.turnId || '',
          role: 'agent',
          kind: 'error',
          text: error?.message || String(error),
          status: error?.task?.status || 'failed',
          metadata: {
            changedFiles: error?.task?.changedFiles || [],
          },
        });
        emitTimelineMessage(errorMessage);
        throw error;
      }
      if (Array.isArray(result?.selectionLocations) && result.selectionLocations.length) {
        try {
          updateProjectSelectionLocations(
            input.project,
            result.selectionLocations,
            input.selectionThumbnails,
          );
        } catch (error) {
          emitProviderEvent({
            type: 'selection-context-persist-failed',
            message: `Agent 选区位置保存失败：${error.message || error}`,
          });
        }
      }
      const resultMessage = persistMessage({
        threadId: result?.threadId || '',
        turnId: result?.turnId || '',
        role: 'agent',
        kind: 'result',
        text: String(result?.finalResponse || ''),
        status: result?.status || 'completed',
        metadata: {
          changedFiles: result?.changedFiles || [],
          selectionLocations: result?.selectionLocations || [],
        },
      });
      emitTimelineMessage(resultMessage);
      return result;
    },
    close() {
      registry.close();
    },
  };
}

function selectionIds(input) {
  const bindings = (Array.isArray(input?.selectionBindings) ? input.selectionBindings : [])
    .map(item => String(item?.uid || item?.binding?.selectionId || item?.selectionId || ''));
  const evidence = (Array.isArray(input?.locatorEvidence?.selections)
    ? input.locatorEvidence.selections
    : []).map(item => String(item?.selectionId || ''));
  return [...new Set([...bindings, ...evidence].filter(Boolean))];
}

module.exports = {
  createConnectAgentService,
};
