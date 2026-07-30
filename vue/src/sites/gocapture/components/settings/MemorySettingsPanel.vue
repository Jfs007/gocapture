<template>
  <div v-if="visible" class="mda-memory-shell" :class="{ 'is-page': isPage }" role="dialog" aria-modal="true" :aria-label="`${PRODUCT_NAME} 设置`">
    <header v-if="!isPage" class="mda-memory-head">
      <div>
        <strong>记忆设置</strong>
        <span>{{ projectLabel }}</span>
      </div>
      <button class="mda-icon mda-memory-close" type="button" title="关闭" aria-label="关闭" @click="memory.closePanel">×</button>
    </header>

    <div class="mda-settings-layout">
      <aside v-if="isPage" class="mda-settings-sidebar">
        <button class="mda-settings-back" type="button" @click="$emit('back')">
          <GoCaptureIcon name="back" :size="16" />
          <span>返回 {{ PRODUCT_NAME }}</span>
        </button>
        <label class="mda-settings-search">
          <GoCaptureIcon name="search" :size="17" />
          <input type="text" placeholder="搜索设置..." disabled>
        </label>
        <div class="mda-settings-group-label">Agent</div>
        <button class="mda-settings-nav" type="button" :class="{ 'is-active': tab === 'locator' }" @click="tab = 'locator'">
          <GoCaptureIcon name="search" :size="17" />Locator
        </button>
        <div class="mda-settings-group-label">项目</div>
        <button class="mda-settings-nav" type="button" :class="{ 'is-active': tab === 'assets' }" @click="tab = 'assets'">
          <GoCaptureIcon name="images" :size="17" />选区资产
        </button>
        <button class="mda-settings-nav is-coming-soon" type="button" @click="showExperienceComingSoon">
          <GoCaptureIcon name="book" :size="17" />
          <span>Experience</span>
          <small>开发中</small>
        </button>
        <button class="mda-settings-nav" type="button" :class="{ 'is-active': tab === 'project' }" @click="tab = 'project'">
          <GoCaptureIcon name="folder" :size="17" />项目摘要
        </button>
        <div class="mda-settings-group-label">扩展</div>
        <button class="mda-settings-nav" type="button" :class="{ 'is-active': tab === 'tools' }" @click="tab = 'tools'">
          <GoCaptureIcon name="construct" :size="17" />Agent 能力
        </button>
      </aside>

      <main class="mda-settings-main">
        <header v-if="isPage" class="mda-settings-main-head">
          <div>
            <span>{{ PRODUCT_NAME }} 设置</span>
            <strong>{{ activeTitle }}</strong>
            <em>{{ projectLabel }}</em>
          </div>
          <button class="mda-settings-primary" type="button" @click="$emit('select-project')">选择源码</button>
        </header>

        <nav v-if="!isPage" class="mda-memory-tabs" aria-label="记忆类型">
          <button type="button" @click="showExperienceComingSoon">Experience · 开发中</button>
          <button type="button" :class="{ 'is-active': tab === 'tools' }" @click="tab = 'tools'">Tools</button>
          <button type="button" :class="{ 'is-active': tab === 'project' }" @click="tab = 'project'">项目摘要</button>
        </nav>

        <div v-if="memoryDependent && memory.loading" class="mda-memory-state">正在读取记忆...</div>
        <div v-else-if="memoryDependent && memory.error && !memory.snapshot" class="mda-memory-state is-error">
          <span>{{ memory.error }}</span>
          <button type="button" @click="memory.load">重试</button>
        </div>

        <section v-else class="mda-memory-body">
      <div v-if="memoryDependent && (memory.message || memory.error)" class="mda-memory-feedback" :class="{ 'is-error': !!memory.error }">
        {{ memory.error || memory.message }}
      </div>
      <template v-if="tab === 'locator'">
        <div class="mda-locator-settings">
          <div class="mda-locator-settings-intro">
            <div>
              <strong>Locator 专用模型</strong>
              <p>可选。使用成本更低的模型先定位源码，再把精确位置交给关联 Agent，可减少主 Agent 的检索轮次和 Token 消耗。未配置时由关联 Agent 完成定位和开发。</p>
            </div>
            <span :class="{ 'is-enabled': !!locatorSelectedModel }">
              {{ locatorSelectedModel ? '已启用' : '由 Agent 处理' }}
            </span>
          </div>

          <div class="mda-locator-choice" role="radiogroup" aria-label="Locator 定位方式">
            <span class="mda-locator-choice-label">定位方式</span>
            <button
              class="mda-locator-option"
              :class="{ 'is-selected': !locatorSelectedId }"
              type="button"
              role="radio"
              :aria-checked="String(!locatorSelectedId)"
              @click="chooseLocatorModel('')"
            >
              <i class="mda-locator-radio" aria-hidden="true" />
              <span>
                <strong>由开发 Agent 处理</strong>
                <small>不单独运行 Locator 模型</small>
              </span>
            </button>
            <div v-for="item in locatorModels" :key="item.id" class="mda-locator-option-row">
              <button
                class="mda-locator-option"
                :class="{ 'is-selected': locatorSelectedId === item.id }"
                type="button"
                role="radio"
                :aria-checked="String(locatorSelectedId === item.id)"
                @click="chooseLocatorModel(item.id)"
              >
                <i class="mda-locator-radio" aria-hidden="true" />
                <span>
                  <strong>{{ item.name }}</strong>
                  <small>{{ item.model }}{{ item.endpoint ? ` · ${item.endpoint}` : '' }}</small>
                </span>
              </button>
              <button
                class="mda-locator-option-edit"
                type="button"
                :aria-label="`编辑 ${item.name}`"
                :title="`编辑 ${item.name}`"
                @click="editLocatorModel(item)"
              >
                <GoCaptureIcon name="settings" :size="17" />
              </button>
            </div>
          </div>

          <div class="mda-locator-add-row">
            <button type="button" @click="editLocatorModel(null)">
              <GoCaptureIcon name="add" :size="16" />
              <span>添加 Locator 模型</span>
            </button>
          </div>
        </div>
      </template>

      <template v-else-if="tab === 'assets'">
        <div v-if="!selectionAssets.length" class="mda-memory-empty">当前页面暂无选区资产。</div>
        <div v-else class="mda-settings-assets">
          <button
            v-for="asset in selectionAssets"
            :key="asset.uid"
            class="mda-settings-asset"
            type="button"
            :aria-label="`查看 ${asset.token} 详情`"
            @click="openAssetDetails(asset)"
          >
            <div v-if="asset.thumbnailUrl" class="mda-settings-asset-thumb" :style="assetThumbStyle(asset)" />
            <div v-else class="mda-settings-asset-thumb is-empty">{{ asset.index }}</div>
            <div class="mda-settings-asset-main">
              <strong>{{ asset.token }}</strong>
              <span>{{ asset.summary }}</span>
              <code>{{ asset.selector || asset.className || asset.text || '-' }}</code>
            </div>
          </button>
        </div>
      </template>

      <template v-else-if="tab === 'experiences'">
        <div v-if="!experiences.length" class="mda-memory-empty">当前项目暂无已保存 Experience。</div>
        <template v-else>
          <label class="mda-memory-field">
            <span>Experience</span>
            <select v-model="experienceId">
              <option v-for="experience in experiences" :key="experience.componentPath" :value="experience.componentPath">
                {{ experience.name }} · {{ experience.validation?.valid ? '有效' : '已失效' }}
              </option>
            </select>
          </label>
          <div v-if="activeExperience" class="mda-memory-form">
            <label class="mda-memory-field">
              <span>名称</span>
              <input v-model="experienceDraft.name" type="text">
            </label>
            <label class="mda-memory-field">
              <span>公共能力路径</span>
              <input :value="activeExperience.componentPath" type="text" disabled>
            </label>
            <label class="mda-memory-field">
              <span>角色</span>
              <input v-model="experienceDraft.role" type="text">
            </label>
            <label class="mda-memory-field">
              <span>检索关键词 <small>每行一个</small></span>
              <textarea v-model="experienceDraft.keywords" rows="4" />
            </label>
            <label class="mda-memory-field">
              <span>证据文件 <small>每行一个；文件不存在时经验自动失效</small></span>
              <textarea v-model="experienceDraft.usageFiles" rows="5" class="is-code" />
            </label>
            <label class="mda-memory-field">
              <span>Experience 文档 <small>Markdown</small></span>
              <textarea v-model="experienceDraft.doc" rows="18" class="is-code" />
            </label>
            <div class="mda-memory-actions">
              <button class="is-primary" type="button" :disabled="memory.saving" @click="saveExperience">
                {{ memory.saving ? '保存中...' : '保存 Experience' }}
              </button>
            </div>
          </div>
        </template>
      </template>

      <template v-else-if="tab === 'tools'">
        <div class="mda-agent-capability-head">
          <div>
            <strong>开发 Agent 的可用能力</strong>
            <p>MCP、Skills 和 GoCapture Tools 会在任务启动时交给当前项目关联的开发 Agent。</p>
          </div>
          <button type="button" :disabled="memory.saving" @click="reloadAgentExtensions">
            {{ memory.saving ? '重载中...' : '重载能力' }}
          </button>
        </div>

        <div v-if="!agentExtensions" class="mda-memory-empty">请先关联本地源码项目。</div>
        <div v-else class="mda-agent-capabilities">
          <section class="mda-agent-capability-section">
            <div class="mda-agent-capability-title">
              <div>
                <strong>开发 Agent</strong>
                <span>Agent 原生提供的基础能力</span>
              </div>
              <em :class="{ 'is-active': agentExtensions.provider?.connected }">
                {{ agentExtensions.provider?.connected ? '已连接' : '未连接' }}
              </em>
            </div>
            <div class="mda-agent-capability-list">
              <div v-for="capability in nativeCapabilities" :key="capability.name" class="mda-agent-capability-item">
                <div>
                  <strong>{{ capability.name }}</strong>
                  <p>{{ capability.description }}</p>
                </div>
                <small>原生</small>
              </div>
            </div>
          </section>

          <section class="mda-agent-capability-section">
            <div class="mda-agent-capability-title">
              <div>
                <strong>GoCapture Tools</strong>
                <span>由 GoCapture 按任务动态挂载的本地能力</span>
              </div>
              <small>{{ agentTools.length }} 个</small>
            </div>
            <div class="mda-agent-capability-list">
              <div v-for="tool in agentTools" :key="tool.name" class="mda-agent-capability-item">
                <div>
                  <strong>{{ tool.name }}</strong>
                  <p>{{ tool.description }}</p>
                </div>
                <small>动态</small>
              </div>
            </div>
          </section>

          <section class="mda-agent-capability-section">
            <div class="mda-agent-capability-title">
              <div>
                <strong>MCP</strong>
                <span>连接外部工具或服务，项目配置写入 <code>.mcp.json</code></span>
              </div>
              <button type="button" @click="openMcpEditor()">添加 MCP</button>
            </div>
            <div v-if="!mcpServers.length" class="mda-agent-capability-empty">当前项目没有 MCP。</div>
            <div v-else class="mda-agent-capability-list">
              <div v-for="server in mcpServers" :key="`${server.source}-${server.name}`" class="mda-agent-capability-item">
                <div>
                  <strong>{{ server.name }}</strong>
                  <p>{{ server.summary || server.transport }}</p>
                </div>
                <div class="mda-agent-capability-actions">
                  <small>{{ server.source === 'project' ? '项目' : '用户' }}</small>
                  <button v-if="server.source === 'project'" type="button" @click="openMcpEditor(server)">编辑</button>
                  <button v-if="server.source === 'project'" class="is-danger" type="button" @click="removeMcp(server)">移除</button>
                </div>
              </div>
            </div>
          </section>

          <section class="mda-agent-capability-section">
            <div class="mda-agent-capability-title">
              <div>
                <strong>Skills</strong>
                <span>向开发 Agent 提供项目约定和工作流程</span>
              </div>
              <button type="button" @click="openSkillEditor()">添加 Skill</button>
            </div>
            <div v-if="!agentSkills.length" class="mda-agent-capability-empty">当前项目没有 Skill。</div>
            <div v-else class="mda-agent-capability-list">
              <div v-for="skill in agentSkills" :key="`${skill.source}-${skill.name}`" class="mda-agent-capability-item">
                <div>
                  <strong>{{ skill.name }}</strong>
                  <p>{{ skill.description || '未提供说明' }}</p>
                </div>
                <div class="mda-agent-capability-actions">
                  <small>{{ skill.source === 'project' ? '项目' : '用户' }}</small>
                  <button v-if="skill.source === 'project'" type="button" @click="openSkillEditor(skill)">重装</button>
                  <button v-if="skill.source === 'project'" class="is-danger" type="button" @click="removeSkill(skill)">移除</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>

      <template v-else>
        <div class="mda-memory-project-note">Project.md 由源码扫描和 Experience 索引自动生成，不在这里手工修改。</div>
        <pre class="mda-memory-project-doc">{{ memory.snapshot?.projectDocument || '暂无项目摘要。' }}</pre>
      </template>
        </section>
        <div v-if="isPage && appUi.toastText" class="mda-settings-toast" role="status">
          {{ appUi.toastText }}
        </div>
      </main>
    </div>
    <Teleport to="body">
      <div
        v-if="locatorEditorExpanded"
        class="mda-model-modal"
        role="presentation"
        @click.self="locatorEditorExpanded = false"
      >
        <section class="mda-model-editor" role="dialog" aria-modal="true" aria-label="Locator 模型配置">
          <header class="mda-model-editor-head">
            <div>
              <strong>Locator 模型</strong>
              <p>仅用于源码定位；保存后立即应用到当前页面。</p>
            </div>
            <button class="mda-model-close" type="button" aria-label="关闭" @click="locatorEditorExpanded = false">
              <GoCaptureIcon name="close" :size="18" />
            </button>
          </header>
          <div class="mda-model-editor-body">
            <div class="mda-model-grid">
              <label>
                <span>名称</span>
                <input v-model="locatorForm.name" class="mda-model-input" type="text">
              </label>
              <label>
                <span>Model</span>
                <select v-model="locatorForm.model" class="mda-model-input">
                  <option value="deepseek-v4-pro">deepseek-v4-pro</option>
                  <option value="deepseek-v4-flash">deepseek-v4-flash</option>
                </select>
              </label>
              <label class="is-wide">
                <span>Endpoint</span>
                <input v-model="locatorForm.endpoint" class="mda-model-input" type="text">
              </label>
              <label class="is-wide">
                <span>API Key</span>
                <input v-model="locatorForm.apiKey" class="mda-model-input" type="password">
              </label>
              <label class="is-wide">
                <span>代理地址</span>
                <input v-model="locatorForm.proxyUrl" class="mda-model-input" type="text" placeholder="可留空">
              </label>
              <label>
                <span>超时（毫秒）</span>
                <input v-model.number="locatorForm.timeoutMs" class="mda-model-input" type="number" min="5000" step="1000">
              </label>
            </div>
          </div>
          <footer class="mda-model-actions">
            <button v-if="locatorEditingId && locatorEditingId === locatorSelectedId" class="mda-model-delete" type="button" @click="removeLocatorModel">删除</button>
            <button type="button" @click="locatorEditorExpanded = false">取消</button>
            <button class="is-primary" type="button" @click="saveLocatorModel">保存并启用</button>
          </footer>
        </section>
      </div>
      <div
        v-if="activeSelectionAsset"
        class="mda-asset-detail-modal"
        role="presentation"
        @click.self="closeAssetDetails"
      >
        <section class="mda-asset-detail" role="dialog" aria-modal="true" aria-label="选区资产详情">
          <header class="mda-asset-detail-head">
            <div>
              <strong>选区详情</strong>
              <code>@{{ activeSelectionAsset.uid }}</code>
            </div>
            <button type="button" aria-label="关闭" @click="closeAssetDetails">
              <GoCaptureIcon name="close" :size="18" />
            </button>
          </header>

          <div class="mda-asset-detail-body">
            <div class="mda-asset-detail-preview">
              <img
                v-if="activeSelectionAsset.thumbnailUrl"
                :src="activeSelectionAsset.thumbnailUrl"
                :alt="`${activeSelectionAsset.token} 选区截图`"
              >
              <div v-else class="mda-asset-detail-preview-empty">暂无选区截图</div>
            </div>

            <div class="mda-asset-detail-info">
              <section>
                <h3>选区信息</h3>
                <dl>
                  <div>
                    <dt>文案</dt>
                    <dd>{{ activeSelectionAsset.text || activeSelectionAsset.assetText || '-' }}</dd>
                  </div>
                  <div>
                    <dt>选择器</dt>
                    <dd><code>{{ activeSelectionAsset.selector || activeSelectionAsset.assetSelector || '-' }}</code></dd>
                  </div>
                  <div>
                    <dt>Class</dt>
                    <dd><code>{{ activeSelectionAsset.className || '-' }}</code></dd>
                  </div>
                  <div>
                    <dt>尺寸</dt>
                    <dd>{{ assetBoxText(activeSelectionAsset) }}</dd>
                  </div>
                  <div v-if="activeSelectionAsset.createdAt">
                    <dt>保存时间</dt>
                    <dd>{{ formatAssetTime(activeSelectionAsset.createdAt) }}</dd>
                  </div>
                </dl>
                <div v-if="assetMarkup(activeSelectionAsset)" class="mda-asset-markup">
                  <span>DOM</span>
                  <pre>{{ assetMarkup(activeSelectionAsset) }}</pre>
                </div>
              </section>

              <section>
                <h3>定位文件</h3>
                <div v-if="assetSourceTargets(activeSelectionAsset).length" class="mda-asset-source-list">
                  <div
                    v-for="(target, index) in assetSourceTargets(activeSelectionAsset)"
                    :key="`${target.file}-${index}`"
                    class="mda-asset-source"
                  >
                    <code>{{ sourceTargetLabel(target) }}</code>
                    <span v-if="target.anchor">{{ target.anchor }}</span>
                  </div>
                </div>
                <p v-else class="mda-asset-source-empty">该选区尚未绑定源码位置。</p>
              </section>
            </div>
          </div>
        </section>
      </div>
      <div
        v-if="extensionEditor"
        class="mda-model-modal"
        role="presentation"
        @click.self="closeExtensionEditor"
      >
        <section class="mda-model-editor mda-extension-editor" role="dialog" aria-modal="true" :aria-label="extensionEditor.kind === 'mcp' ? 'MCP 配置' : 'Skill 配置'">
          <header class="mda-model-editor-head">
            <div>
              <strong>{{ extensionEditor.kind === 'mcp' ? 'MCP' : 'Skill' }}</strong>
              <p>保存到当前项目，并立即重载到开发 Agent。</p>
            </div>
            <button class="mda-model-close" type="button" aria-label="关闭" @click="closeExtensionEditor">
              <GoCaptureIcon name="close" :size="18" />
            </button>
          </header>
          <div class="mda-model-editor-body">
            <div v-if="extensionEditor.kind === 'mcp'" class="mda-extension-form">
              <label>
                <span>名称</span>
                <input v-model="mcpDraft.name" class="mda-model-input" type="text" placeholder="例如 project-tools">
              </label>
              <label>
                <span>连接方式</span>
                <select v-model="mcpDraft.transport" class="mda-model-input">
                  <option value="stdio">本地命令（stdio）</option>
                  <option value="http">远程 HTTP</option>
                  <option value="sse">远程 SSE</option>
                </select>
              </label>
              <label v-if="mcpDraft.transport === 'stdio'">
                <span>Command</span>
                <input v-model="mcpDraft.command" class="mda-model-input" type="text" placeholder="npx">
              </label>
              <label v-if="mcpDraft.transport === 'stdio'">
                <span>参数 <small>每行一个</small></span>
                <textarea v-model="mcpDraft.args" class="mda-model-input is-code" rows="4" />
              </label>
              <label v-if="mcpDraft.transport === 'stdio'">
                <span>环境变量 <small>JSON，可留空</small></span>
                <textarea v-model="mcpDraft.env" class="mda-model-input is-code" rows="4" placeholder='{"TOKEN":"..."}' />
              </label>
              <label v-else>
                <span>URL</span>
                <input v-model="mcpDraft.url" class="mda-model-input" type="url" placeholder="https://example.com/mcp">
              </label>
              <label v-if="mcpDraft.transport !== 'stdio'">
                <span>Headers <small>JSON，可留空</small></span>
                <textarea v-model="mcpDraft.headers" class="mda-model-input is-code" rows="4" placeholder='{"Authorization":"Bearer ..."}' />
              </label>
            </div>
            <div v-else class="mda-extension-form">
              <label>
                <span>名称</span>
                <input v-model="skillDraft.name" class="mda-model-input" type="text" placeholder="例如 release-check">
              </label>
              <label>
                <span>说明</span>
                <input v-model="skillDraft.description" class="mda-model-input" type="text">
              </label>
              <label>
                <span>允许使用的工具 <small>每行一个，可留空</small></span>
                <textarea v-model="skillDraft.allowedTools" class="mda-model-input is-code" rows="3" />
              </label>
              <label>
                <span>Skill 指令</span>
                <textarea v-model="skillDraft.instructions" class="mda-model-input is-code" rows="12" />
              </label>
            </div>
          </div>
          <footer class="mda-model-actions">
            <button type="button" @click="closeExtensionEditor">取消</button>
            <button class="is-primary" type="button" :disabled="memory.saving" @click="saveExtension">
              {{ memory.saving ? '保存中...' : '保存并重载' }}
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, unref, watch } from 'vue';
import GoCaptureIcon from '../common/GoCaptureIcon.vue';
import { useAppUiStore } from '../../stores/app-ui.store';
import { useMemoryStore } from '../../stores/memory.store';
import { useSelectionStore } from '../../stores/selection.store';
import { PRODUCT_NAME } from '../../app/config/product';

const props = withDefaults(defineProps<{
  mode?: 'panel' | 'page';
  modelRuntime?: Record<string, any> | null;
}>(), {
  mode: 'panel',
  modelRuntime: null
});
defineEmits<{
  (event: 'back'): void;
  (event: 'select-project'): void;
}>();

const memory = useMemoryStore();
const appUi = useAppUiStore();
const selectionStore = useSelectionStore();
const requestedSection = new URLSearchParams(window.location.search).get('section');
const allowedSections = new Set(['locator', 'assets', 'tools', 'project']);
const initialTab: 'locator' | 'assets' | 'tools' | 'project' = allowedSections.has(String(requestedSection))
  ? requestedSection as 'locator' | 'assets' | 'tools' | 'project'
  : 'locator';
const tab = ref<'locator' | 'assets' | 'experiences' | 'tools' | 'project'>(initialTab);
const locatorEditorExpanded = ref(false);
const locatorEditingId = ref('');
const activeSelectionAsset = ref<any | null>(null);
const extensionEditor = ref<{ kind: 'mcp' | 'skill' } | null>(null);
const experienceId = ref('');
const experienceDraft = reactive({
  name: '',
  role: '',
  keywords: '',
  usageFiles: '',
  doc: ''
});
const mcpDraft = reactive({
  name: '',
  transport: 'stdio',
  command: '',
  args: '',
  env: '',
  url: '',
  headers: ''
});
const skillDraft = reactive({
  name: '',
  description: '',
  allowedTools: '',
  instructions: ''
});

const experiences = computed(() => memory.snapshot?.experiences || []);
const agentExtensions = computed(() => memory.extensions || null);
const nativeCapabilities = computed(() => agentExtensions.value?.nativeCapabilities || []);
const agentTools = computed(() => agentExtensions.value?.tools || []);
const mcpServers = computed(() => agentExtensions.value?.mcpServers || []);
const agentSkills = computed(() => agentExtensions.value?.skills || []);
const locatorModels = computed(() => unref(props.modelRuntime?.modelConfigs) || []);
const locatorSelectedId = computed(() => String(unref(props.modelRuntime?.selectedModelId) || ''));
const locatorSelectedModel = computed(() => unref(props.modelRuntime?.selectedModel) || null);
const locatorForm = computed(() => unref(props.modelRuntime?.modelForm) || {});
const selectionAssets = computed(() => selectionStore.promptAssets || []);
const activeExperience = computed(() => experiences.value.find((item: any) => item.componentPath === experienceId.value) || null);
const projectLabel = computed(() => memory.snapshot?.project?.name || '当前源码项目');
const isPage = computed(() => props.mode === 'page');
const visible = computed(() => isPage.value || memory.open);
const memoryDependent = computed(() => tab.value === 'tools' || tab.value === 'project');
const activeTitle = computed(() => {
  if (tab.value === 'locator') return 'Locator';
  if (tab.value === 'assets') return '选区资产';
  if (tab.value === 'experiences') return 'Experience';
  if (tab.value === 'tools') return 'Agent 能力';
  return '项目摘要';
});

function chooseLocatorModel(id: string) {
  if (id) props.modelRuntime?.selectModelAndEnable?.(id);
  else props.modelRuntime?.disableModelAssist?.();
}

function showExperienceComingSoon() {
  appUi.setToast('Experience 功能开发中');
}

function openMcpEditor(server: any = null) {
  const config = server?.config || {};
  mcpDraft.name = String(server?.name || '');
  mcpDraft.transport = String(server?.transport || 'stdio');
  mcpDraft.command = String(config.command || '');
  mcpDraft.args = toLines(config.args);
  mcpDraft.env = editableJson(config.env);
  mcpDraft.url = String(config.url || '');
  mcpDraft.headers = editableJson(config.headers);
  extensionEditor.value = { kind: 'mcp' };
}

function openSkillEditor(skill: any = null) {
  skillDraft.name = String(skill?.name || '');
  skillDraft.description = String(skill?.description || '');
  skillDraft.allowedTools = toLines(skill?.allowedTools);
  skillDraft.instructions = String(skill?.instructions || '');
  extensionEditor.value = { kind: 'skill' };
}

function closeExtensionEditor() {
  extensionEditor.value = null;
}

function editableJson(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  return Object.keys(value as Record<string, unknown>).length
    ? JSON.stringify(value, null, 2)
    : '';
}

function parseOptionalJson(value: string, label: string) {
  const text = String(value || '').trim();
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
    return parsed;
  } catch {
    throw new Error(`${label} 必须是 JSON 对象`);
  }
}

async function saveExtension() {
  try {
    const ok = extensionEditor.value?.kind === 'mcp'
      ? await memory.installExtension('mcp', {
          name: mcpDraft.name,
          transport: mcpDraft.transport,
          command: mcpDraft.command,
          args: fromLines(mcpDraft.args),
          env: parseOptionalJson(mcpDraft.env, '环境变量'),
          url: mcpDraft.url,
          headers: parseOptionalJson(mcpDraft.headers, 'Headers')
        })
      : await memory.installExtension('skill', {
          name: skillDraft.name,
          description: skillDraft.description,
          allowedTools: fromLines(skillDraft.allowedTools),
          instructions: skillDraft.instructions
        });
    if (ok) {
      closeExtensionEditor();
      appUi.setToast(memory.message || 'Agent 能力已更新');
    }
  } catch (cause: any) {
    appUi.setToast(cause?.message || '扩展配置格式不正确');
  }
}

async function removeMcp(server: any) {
  if (!window.confirm(`移除项目 MCP「${server.name}」？`)) return;
  const ok = await memory.removeExtension('mcp', server.name);
  if (ok) appUi.setToast(memory.message);
}

async function removeSkill(skill: any) {
  if (!window.confirm(`移除项目 Skill「${skill.name}」？`)) return;
  const ok = await memory.removeExtension('skill', skill.name);
  if (ok) appUi.setToast(memory.message);
}

async function reloadAgentExtensions() {
  const ok = await memory.reloadExtensions();
  if (ok) appUi.setToast(memory.message);
}

function editLocatorModel(model: any) {
  if (model) props.modelRuntime?.openModelEditor?.(model);
  else props.modelRuntime?.openProviderModelEditor?.('deepseek');
  locatorEditingId.value = String(model?.id || '');
  locatorEditorExpanded.value = true;
}

function saveLocatorModel() {
  props.modelRuntime?.saveModelForm?.();
  locatorEditingId.value = '';
  locatorEditorExpanded.value = false;
}

function removeLocatorModel() {
  props.modelRuntime?.removeSelectedModel?.();
  locatorEditingId.value = '';
  locatorEditorExpanded.value = false;
}

watch(experiences, value => {
  if (!value.some((item: any) => item.componentPath === experienceId.value)) experienceId.value = value[0]?.componentPath || '';
}, { immediate: true });

watch(activeExperience, experience => {
  if (!experience) return;
  experienceDraft.name = experience.name || '';
  experienceDraft.role = experience.role || '';
  experienceDraft.keywords = toLines(experience.keywords);
  experienceDraft.usageFiles = toLines(experience.usageFiles);
  experienceDraft.doc = experience.doc || '';
}, { immediate: true });

function toLines(value: unknown) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function fromLines(value: string) {
  return value.split('\n').map(item => item.trim()).filter(Boolean);
}

async function saveExperience() {
  if (!activeExperience.value) return;
  const ok = await memory.saveExperience({
    componentPath: activeExperience.value.componentPath,
    name: experienceDraft.name,
    role: experienceDraft.role,
    keywords: fromLines(experienceDraft.keywords),
    usageFiles: fromLines(experienceDraft.usageFiles),
    doc: experienceDraft.doc
  });
  if (ok) appUi.setToast('Experience 已保存');
}

function assetThumbStyle(asset: any) {
  return asset?.thumbnailUrl ? { backgroundImage: `url("${asset.thumbnailUrl}")` } : {};
}

function openAssetDetails(asset: any) {
  activeSelectionAsset.value = asset;
}

function closeAssetDetails() {
  activeSelectionAsset.value = null;
}

function assetSourceTargets(asset: any) {
  return Array.isArray(asset?.sourceBinding?.targets)
    ? asset.sourceBinding.targets.filter((target: any) => String(target?.file || '').trim())
    : [];
}

function sourceTargetLabel(target: any) {
  const startLine = Number(target?.line || target?.startLine || 0);
  const endLine = Number(target?.endLine || 0);
  const lineText = startLine
    ? `:${startLine}${endLine > startLine ? `-${endLine}` : ''}`
    : '';
  return `${String(target?.file || '')}${lineText}`;
}

function assetMarkup(asset: any) {
  const markup = String(
    asset?.outerHtml
    || asset?.assetOuterHtml
    || asset?.innerHtml
    || asset?.assetInnerHtml
    || '',
  ).trim();
  if (!markup) return '';
  return markup.length > 4000 ? `${markup.slice(0, 4000)}\n...` : markup;
}

function assetBoxText(asset: any) {
  const box = asset?.box || asset?.assetBox;
  if (!box) return '-';
  const width = Math.round(Number(box.width || 0));
  const height = Math.round(Number(box.height || 0));
  const x = Math.round(Number(box.x || 0));
  const y = Math.round(Number(box.y || 0));
  return `${width} × ${height} · (${x}, ${y})`;
}

function formatAssetTime(value: number) {
  const date = new Date(Number(value || 0));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { hour12: false });
}
</script>
