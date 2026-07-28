<template>
  <section class="mda-chat-thread" aria-label="页面改造对话">
    <article
      v-for="message in messages"
      :key="message.id"
      class="mda-chat-message"
      :class="`is-${message.role}`"
    >
      <div class="mda-message-avatar">{{ avatarText(message.role) }}</div>
      <div class="mda-message-bubble">
        <div v-if="showMessageWork(message)" class="mda-message-work">
          <button
            v-if="hasLogs(message)"
            class="mda-message-work-toggle"
            type="button"
            :aria-expanded="String(isLogExpanded(message.id, message.logExpanded))"
            @click="toggleLog(message.id, message.logExpanded)"
          >
            <span class="mda-message-work-label">{{ messageWorkLabel(message) }}</span>
            <i class="mda-message-work-caret" :class="{ 'is-open': isLogExpanded(message.id, message.logExpanded) }" />
          </button>
          <div v-else class="mda-message-work-label">{{ messageWorkLabel(message) }}</div>
          <button
            v-if="hasLogs(message)"
            class="mda-message-log-copy"
            type="button"
            title="复制全部日志"
            aria-label="复制全部日志"
            @click="copyAllLogs(message.logs)"
          >
            <GoCaptureIcon name="copy" :size="15" />
          </button>
        </div>
        <div v-if="hasLogs(message) && isLogExpanded(message.id, message.logExpanded)" class="mda-message-logs">
          <div class="mda-log-chain" role="list" aria-label="Agent 调用链">
            <div
              v-for="(node, logIndex) in logChain(message.logs)"
              :key="node.id"
              class="mda-log-node"
              :class="`is-${node.kind}`"
              role="listitem"
            >
              <span class="mda-log-node-marker" aria-hidden="true" />
              <div class="mda-log-node-body">
                <button
                  v-if="node.expandable"
                  class="mda-log-node-head is-expandable"
                  type="button"
                  :aria-expanded="String(isNodeExpanded(message.id, logIndex, node.kind))"
                  @click="toggleNode(message.id, logIndex, node.kind)"
                >
                  <span class="mda-log-node-actor">{{ node.actor }}</span>
                  <span class="mda-log-node-title">{{ node.title }}</span>
                  <i class="mda-message-work-caret" :class="{ 'is-open': isNodeExpanded(message.id, logIndex, node.kind) }" />
                </button>
                <div v-else class="mda-log-node-head">
                  <span class="mda-log-node-actor">{{ node.actor }}</span>
                  <span class="mda-log-node-title">{{ node.title }}</span>
                </div>
                <template v-if="isCandidateLog(node.raw)">
                  <div class="mda-message-log-item is-candidate-log">
                    <span class="mda-log-file-label">{{ candidatePrefix(node.raw) }}</span>
                    <button class="mda-log-file-link" type="button" @click="commands.openSourceFile(candidateFile(node.raw))">
                      {{ candidateFile(node.raw) }}
                    </button>
                  </div>
                </template>
                <pre
                  v-else-if="node.expandable && isNodeExpanded(message.id, logIndex, node.kind)"
                  class="mda-message-log-pre"
                >{{ node.raw }}</pre>
              </div>
            </div>
          </div>
        </div>
        <div class="mda-message-content" :class="{ 'has-work': showMessageWork(message) }">
          <div v-if="message.title" class="mda-message-title">{{ message.title }}</div>
          <div v-if="message.text" class="mda-message-text">{{ message.text }}</div>
          <pre v-if="message.pre" class="mda-message-pre">{{ message.pre }}</pre>
          <div v-if="message.action === 'choose-project'" class="mda-message-actions">
            <button class="mda-btn mda-btn-primary" type="button" :disabled="sourceServiceStatus === 'loading'" @click="commands.selectProject">
              {{ sourceServiceStatus === 'loading' ? '选择中' : '选择源码' }}
            </button>
          </div>
          <div v-if="message.action === 'copy-prompt'" class="mda-message-actions">
            <button class="mda-btn" type="button" @click="commands.copyPrompt">复制提示词</button>
          </div>
          <div v-if="message.action === 'connect-agent'" class="mda-message-actions">
            <button class="mda-btn mda-btn-primary" type="button" :disabled="connectAgentStore.loading" @click="openAgentPicker">
              {{ connectAgentStore.loading ? '检查中...' : '关联开发 Agent' }}
            </button>
          </div>
          <div v-if="message.action === 'agent-settings'" class="mda-project-config-actions">
            <button class="mda-project-config-card is-agent-primary" type="button" @click="openAgentPicker">
              <span class="mda-project-config-main">
                <em>主要职责</em>
                <strong class="mda-project-config-title">
                  <ModelBrandIcon :name="connectAgentStore.activeProvider?.id || 'agent'" :size="18" />
                  开发 Agent
                </strong>
                <small>{{ activeAgentLabel }}</small>
              </span>
              <b>重新选择</b>
            </button>
            <button class="mda-locator-optional-row" type="button" @click="commands.openSettings('locator')">
              <span>
                <strong>Locator</strong>
                <small>可选前置定位；未配置时由开发 Agent 完成全部工作</small>
              </span>
              <b>配置可选优化</b>
              <span class="mda-locator-card-help">
                为什么配置？
                <span class="mda-locator-help-tip" role="tooltip">
                  可用成本更低的模型先定位源码，再把位置交给开发 Agent，从而减少主 Agent 的检索轮次和 Token 消耗。它不是必需步骤。
                </span>
              </span>
            </button>
          </div>
          <time
            v-if="message.createdAt"
            class="mda-message-time"
            :datetime="messageDateTime(message.createdAt)"
            :title="messageFullTime(message.createdAt)"
          >{{ messageTime(message.createdAt) }}</time>
        </div>
      </div>
    </article>

    <div v-if="sourceServiceError" class="mda-warning">{{ sourceServiceError }}</div>
    <div v-if="candidateError" class="mda-warning">{{ candidateError }}</div>

    <Teleport to="body">
      <div
        v-if="connectAgentStore.threadPickerVisible"
        class="mda-thread-picker-backdrop"
        role="presentation"
        @click.self="connectAgentStore.closeThreadPicker"
      >
        <section class="mda-thread-picker" role="dialog" aria-modal="true" aria-label="选择开发 Agent">
          <header class="mda-thread-picker-head">
            <div>
              <h2>选择开发 Agent</h2>
              <p>Agent 与当前项目关联；支持任务绑定的 Agent 会继续使用所选任务上下文。</p>
            </div>
            <button
              class="mda-thread-picker-close"
              type="button"
              aria-label="关闭"
              @click="connectAgentStore.closeThreadPicker"
            >
              <GoCaptureIcon name="close" :size="18" />
            </button>
          </header>

          <div class="mda-agent-common-settings">
            <div>
              <strong>项目网络代理</strong>
              <small>可选。统一应用于当前项目启动的 Codex 和 Claude Code。</small>
            </div>
            <div class="mda-agent-proxy-control">
              <input
                v-model.trim="projectProxy"
                type="url"
                placeholder="例如 http://127.0.0.1:7890"
                aria-label="项目 Agent 代理地址"
              >
              <button type="button" :disabled="connectAgentStore.settingsSaving" @click="saveProjectProxy">
                {{ connectAgentStore.settingsSaving ? '保存中' : '保存' }}
              </button>
            </div>
          </div>

          <div class="mda-agent-provider-grid" aria-label="可用 Agent">
            <div
              v-for="provider in connectAgentStore.providers"
              :key="provider.id"
              class="mda-agent-provider-shell"
              :class="{ 'is-selected': connectAgentStore.pickerProviderId === provider.id }"
            >
              <button
                class="mda-agent-provider-card"
                type="button"
                :disabled="connectAgentStore.loading"
                @click="chooseAgent(provider.id)"
              >
                <span class="mda-agent-provider-icon">
                  <ModelBrandIcon :name="provider.id || provider.name" :size="24" />
                </span>
                <span class="mda-agent-provider-main">
                  <strong>{{ provider.name }}</strong>
                  <small>{{ providerSummary(provider) }}</small>
                </span>
                <span class="mda-agent-provider-state" :class="{ 'is-connected': provider.connected }">
                  {{ provider.connected ? '已连接' : provider.installed ? '可连接' : '未安装' }}
                </span>
              </button>
              <button
                v-if="provider.supportsRuntimeConfig"
                class="mda-agent-provider-config"
                type="button"
                :disabled="connectAgentStore.loading"
                @click="openProviderConfig(provider)"
              >
                配置运行模型
              </button>
            </div>
          </div>

          <div v-if="connectAgentStore.threadLoading" class="mda-thread-picker-state">正在读取 Agent 任务…</div>
          <template v-else-if="connectAgentStore.pickerProvider?.supportsThreadBinding">
            <ThreadGroup
              title="当前项目"
              :empty-text="`${connectAgentStore.pickerProvider.name} 中还没有这个项目的任务`"
              :threads="connectAgentStore.threadGroups.project"
              :binding-id="connectAgentStore.bindingThreadId"
              @bind="bindAgentThread"
            />
            <ThreadGroup
              title="最近"
              :empty-text="`没有可绑定的最近任务，请先在 ${connectAgentStore.pickerProvider.name} 中新建任务`"
              :threads="connectAgentStore.threadGroups.recent"
              :binding-id="connectAgentStore.bindingThreadId"
              @bind="bindAgentThread"
            />
          </template>
          <div v-else-if="connectAgentStore.pickerProvider?.connected" class="mda-agent-provider-note">
            {{ connectAgentStore.pickerProvider.name }} 已关联。首次发送开发需求时会为当前项目建立并保存会话。
          </div>
          <p v-if="connectAgentStore.connectionError" class="mda-thread-picker-error">
            {{ connectAgentStore.connectionError }}
          </p>
        </section>
      </div>

      <div
        v-if="providerConfigVisible"
        class="mda-thread-picker-backdrop"
        role="presentation"
        @click.self="closeProviderConfig"
      >
        <section class="mda-provider-config-dialog" role="dialog" aria-modal="true" :aria-label="`${configProvider?.name || 'Agent'} 运行模型配置`">
          <header class="mda-thread-picker-head">
            <div>
              <h2>{{ configProvider?.name || 'Agent' }} 运行模型</h2>
              <p>仅影响 GoCapture 启动的当前 Agent，不修改本机全局配置。</p>
            </div>
            <button class="mda-thread-picker-close" type="button" aria-label="关闭" @click="closeProviderConfig">
              <GoCaptureIcon name="close" :size="18" />
            </button>
          </header>

          <div class="mda-provider-config-body">
            <fieldset class="mda-provider-mode-options">
              <legend>模型来源</legend>
              <label v-for="option in runtimeBackendOptions" :key="option.value">
                <input v-model="runtimeForm.backendId" type="radio" :value="option.value">
                <span>
                  <strong class="mda-provider-mode-title">
                    <ModelBrandIcon :name="option.iconName" :size="20" />
                    {{ option.label }}
                  </strong>
                  <small>{{ option.description }}</small>
                </span>
              </label>
            </fieldset>
            <p class="mda-provider-mode-explanation">{{ runtimeProviderExplanation }}</p>

            <template v-if="runtimeForm.backendId !== 'inherit'">
              <label v-if="selectedBackend?.configurable && runtimeForm.backendId !== 'anthropic'" class="mda-provider-config-field">
                <span>Endpoint</span>
                <input v-model.trim="runtimeForm.baseUrl" type="url" :placeholder="selectedBackend?.defaultBaseUrl || 'https://gateway.example.com'">
              </label>
              <div class="mda-provider-config-grid">
                <label class="mda-provider-config-field">
                  <span>主模型</span>
                  <input v-model.trim="runtimeForm.model" type="text" :placeholder="selectedBackend?.defaultModel || '留空使用 Agent 默认值'">
                </label>
                <label class="mda-provider-config-field">
                  <span>快速 / 子 Agent 模型</span>
                  <input v-model.trim="runtimeForm.fastModel" type="text" :placeholder="selectedBackend?.defaultFastModel || '可留空'">
                </label>
              </div>
              <label class="mda-provider-config-field">
                <span>
                  {{ selectedBackend?.name || '模型后端' }} API Key
                  {{ configProvider?.authMode === 'apikey' && configProvider?.authBackendId === runtimeForm.backendId ? '（留空则沿用已保存密钥）' : '' }}
                </span>
                <input v-model.trim="runtimeApiKey" type="password" autocomplete="new-password" placeholder="sk-...">
              </label>
              <label class="mda-provider-config-field">
                <span>推理强度</span>
                <select v-model="runtimeForm.effort">
                  <option value="">使用模型默认值</option>
                  <option value="high">High</option>
                  <option value="max">Max</option>
                </select>
              </label>
            </template>

            <p v-if="providerConfigError" class="mda-thread-picker-error">{{ providerConfigError }}</p>
          </div>

          <footer class="mda-provider-config-actions">
            <button type="button" @click="closeProviderConfig">取消</button>
            <button class="is-primary" type="button" :disabled="providerConfigSaving" @click="saveProviderConfig">
              {{ providerConfigSaving ? '验证中…' : '保存并连接' }}
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useGoCaptureCommands } from '../../app/runtime/commands';
import { useChatStore } from '../../stores/chat.store';
import { useProjectStore } from '../../stores/project.store';
import { useSearchStore } from '../../stores/search.store';
import { useConnectAgentStore } from '../../stores/connect-agent.store';
import { buildLogChain, serializeLogs } from '../../app/presenters/log-chain';
import GoCaptureIcon from '../common/GoCaptureIcon.vue';
import ModelBrandIcon from '../common/ModelBrandIcon.vue';
import ThreadGroup from './ThreadGroup.vue';

const commands = useGoCaptureCommands();
const chatStore = useChatStore();
const projectStore = useProjectStore();
const searchStore = useSearchStore();
const connectAgentStore = useConnectAgentStore();
const messages = computed(() => chatStore.messages);
const sourceServiceStatus = computed(() => projectStore.serviceStatus);
const sourceServiceError = computed(() => projectStore.serviceError);
const candidateError = computed(() => searchStore.error);
const activeAgentLabel = computed(() => {
  const provider = connectAgentStore.activeProvider;
  if (!provider) return '选择 Agent';
  return `${provider.name}${provider.projectThreadName ? ` · ${provider.projectThreadName}` : ''}`;
});
const nowTick = ref(Date.now());
const logOpenState = ref({});
const logNodeOpenState = ref({});
const providerConfigVisible = ref(false);
const providerConfigSaving = ref(false);
const providerConfigError = ref('');
const configProviderId = ref('');
const runtimeApiKey = ref('');
const projectProxy = ref('');
const runtimeForm = ref({
  backendId: 'inherit',
  protocol: 'inherit',
  baseUrl: '',
  model: '',
  fastModel: '',
  effort: ''
});
const configProvider = computed(() =>
  connectAgentStore.providers.find(provider => provider.id === configProviderId.value) || null);
const runtimeBackendOptions = computed(() =>
  (configProvider.value?.availableModelBackends || []).map(backend => ({
    value: backend.id,
    label: backend.name,
    description: backendDescription(backend),
    iconName: backend.id === 'inherit'
      ? (configProvider.value?.id || configProvider.value?.name || 'agent')
      : backend.id
  })));
const selectedBackend = computed(() =>
  configProvider.value?.availableModelBackends?.find(
    backend => backend.id === runtimeForm.value.backendId
  ) || null);
const runtimeProviderExplanation = computed(() =>
  backendExplanation(selectedBackend.value, configProvider.value));
let clockTimer = 0;

async function openAgentPicker() {
  const opened = await connectAgentStore.openAgentPicker(projectStore.current?.path || '');
  if (opened) projectProxy.value = connectAgentStore.projectSettings.proxy || '';
}

async function saveProjectProxy() {
  await connectAgentStore.saveProjectSettings({
    ...connectAgentStore.projectSettings,
    proxy: projectProxy.value
  });
}

async function chooseAgent(providerId) {
  await connectAgentStore.chooseProvider(providerId);
}

async function bindAgentThread(threadId) {
  await connectAgentStore.bindThread(projectStore.current?.path || '', threadId);
}

function providerSummary(provider) {
  if (!provider.installed) return provider.message || '未检测到本地 CLI';
  const backendId = provider.runtimeConfig?.backendId;
  if (backendId && backendId !== 'inherit') {
    const backend = provider.availableModelBackends?.find(item => item.id === backendId);
    return `${backend?.name || backendId} · ${provider.runtimeConfig.model || '默认模型'}`;
  }
  if (provider.projectThreadName) return provider.projectThreadName;
  if (provider.supportsThreadBinding) return '选择一个项目任务继续对话';
  return provider.message || '首次开发时建立项目会话';
}

function openProviderConfig(provider) {
  const config = provider?.runtimeConfig || {};
  configProviderId.value = provider?.id || '';
  runtimeForm.value = {
    backendId: config.backendId || 'inherit',
    protocol: config.protocol || 'inherit',
    baseUrl: config.baseUrl || '',
    model: config.model || '',
    fastModel: config.fastModel || '',
    effort: config.effort || ''
  };
  runtimeApiKey.value = '';
  providerConfigError.value = '';
  providerConfigVisible.value = true;
}

function closeProviderConfig() {
  if (providerConfigSaving.value) return;
  providerConfigVisible.value = false;
}

async function saveProviderConfig() {
  const provider = configProvider.value;
  if (!provider) return;
  if (runtimeForm.value.backendId === 'deepseek') {
    const endpoint = runtimeForm.value.baseUrl.replace(/\/+$/, '');
    if (endpoint === 'https://api.deepseek.com/chat/completions'
      || endpoint === 'https://api.deepseek.com/v1'
      || endpoint === 'https://api.deepseek.com') {
      providerConfigError.value = 'Claude Code 不能使用 Chat Completions 地址，请改为 https://api.deepseek.com/anthropic';
      return;
    }
  }
  if (runtimeForm.value.backendId !== 'inherit'
    && !runtimeApiKey.value
    && !(provider.authMode === 'apikey' && provider.authBackendId === runtimeForm.value.backendId)) {
    providerConfigError.value = `首次配置 ${selectedBackend.value?.name || '模型后端'} 时需要填写 API Key。`;
    return;
  }
  providerConfigSaving.value = true;
  providerConfigError.value = '';
  try {
    const options = {
      runtimeConfig: { ...runtimeForm.value },
      ...(runtimeApiKey.value
        ? {
            auth: {
              mode: 'apikey',
              backendId: runtimeForm.value.backendId,
              apiKey: runtimeApiKey.value,
              proxy: connectAgentStore.projectSettings.proxy || ''
            }
          }
        : {})
    };
    const connected = await connectAgentStore.connectProvider(
      provider.id,
      projectStore.current?.path || '',
      options
    );
    if (!connected) {
      providerConfigError.value = connectAgentStore.connectionError || '模型配置验证失败';
      return;
    }
    providerConfigVisible.value = false;
  } finally {
    providerConfigSaving.value = false;
  }
}

watch(() => runtimeForm.value.backendId, (backendId, previousBackendId) => {
  if (backendId === previousBackendId) return;
  const backend = selectedBackend.value;
  runtimeForm.value.protocol = backend?.protocol || 'inherit';
  runtimeForm.value.baseUrl = backend?.defaultBaseUrl || '';
  runtimeForm.value.model = backend?.defaultModel || '';
  runtimeForm.value.fastModel = backend?.defaultFastModel || '';
  runtimeForm.value.effort = backendId === 'deepseek' ? 'max' : '';
});

function backendDescription(backend) {
  if (backend.id === 'inherit') return '读取 Agent 自己的用户或项目配置';
  if (backend.protocol === 'anthropic-messages') return '通过 Anthropic Messages 协议提供模型';
  if (backend.protocol === 'openai-responses') return '通过 OpenAI Responses 协议提供模型';
  return backend.protocol || '模型后端';
}

function backendExplanation(backend, provider) {
  if (!backend || !provider) return '';
  if (backend.id === 'inherit') {
    return `GoCapture 不覆盖模型与密钥，${provider.name} 使用自己已有的登录、用户和项目配置。`;
  }
  return `${provider.name} 仍负责 Agent、工具与开发工作流；模型请求通过 ${backend.name} 的 ${backend.protocol} 协议执行。该配置只影响 GoCapture 启动的进程。`;
}

watch(messages, nextMessages => {
  const nextState = {};
  for (const message of nextMessages || []) {
    if (!message?.id) continue;
    if (Object.prototype.hasOwnProperty.call(logOpenState.value, message.id)) {
      nextState[message.id] = logOpenState.value[message.id];
    } else {
      nextState[message.id] = !!message.logExpanded;
    }
  }
  logOpenState.value = nextState;
}, { immediate: true });

onMounted(() => {
  clockTimer = window.setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  window.clearInterval(clockTimer);
});

function avatarText(role) {
  if (role === 'user') return '你';
  if (role === 'agent') return 'Agent';
  return '系统';
}

function hasLogs(message) {
  return Array.isArray(message?.logs) && message.logs.length > 0;
}

function showMessageWork(message) {
  return message?.role !== 'user' && (hasLogs(message) || Number(message?.durationStartedAt || 0) > 0);
}

function isLogExpanded(id, fallback) {
  if (!id) return !!fallback;
  return Object.prototype.hasOwnProperty.call(logOpenState.value, id) ? logOpenState.value[id] : !!fallback;
}

function toggleLog(id, fallback) {
  logOpenState.value = {
    ...logOpenState.value,
    [id]: !isLogExpanded(id, fallback)
  };
}

function logChain(logs) {
  return buildLogChain(logs || []);
}

function nodeKey(messageId, index) {
  return `${messageId}:${index}`;
}

function nodeDefaultExpanded(kind) {
  return kind === 'llm-output' || kind === 'tool-call' || kind === 'decision' || kind === 'error';
}

function isNodeExpanded(messageId, index, kind) {
  const key = nodeKey(messageId, index);
  return Object.prototype.hasOwnProperty.call(logNodeOpenState.value, key)
    ? logNodeOpenState.value[key]
    : nodeDefaultExpanded(kind);
}

function toggleNode(messageId, index, kind) {
  const key = nodeKey(messageId, index);
  logNodeOpenState.value = {
    ...logNodeOpenState.value,
    [key]: !isNodeExpanded(messageId, index, kind)
  };
}

function copyAllLogs(logs) {
  commands.copyText(serializeLogs(logs || []));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function messageDurationMs(message) {
  const startedAt = Number(message?.durationStartedAt || 0);
  if (!startedAt) return 0;
  const finishedAt = Number(message?.durationFinishedAt || 0);
  return Math.max(0, (finishedAt || nowTick.value) - startedAt);
}

function messageWorkLabel(message) {
  const duration = messageDurationMs(message);
  return `${message?.durationActive ? '处理中' : '已处理'} ${formatDuration(duration)}`;
}

function messageDate(value) {
  const date = new Date(Number(value || 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function messageTime(value) {
  const date = messageDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

function messageFullTime(value) {
  const date = messageDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

function messageDateTime(value) {
  return messageDate(value)?.toISOString() || '';
}

function isCandidateLog(log) {
  return /^候选\s+\d+:\s+/.test(log) || /^文件:\s+/.test(log);
}

function candidatePrefix(log) {
  const match = String(log || '').match(/^(候选\s+\d+:\s+|文件:\s+)/);
  return match ? match[1] : '';
}

function candidateFile(log) {
  return String(log || '').replace(/^(候选\s+\d+:\s+|文件:\s+)/, '').trim();
}
</script>
