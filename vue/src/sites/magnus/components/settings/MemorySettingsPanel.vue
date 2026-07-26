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
          <MagnusIcon name="back" :size="16" />
          <span>返回 {{ PRODUCT_NAME }}</span>
        </button>
        <label class="mda-settings-search">
          <MagnusIcon name="search" :size="17" />
          <input type="text" placeholder="搜索设置..." disabled>
        </label>
        <div class="mda-settings-group-label">Agent</div>
        <button class="mda-settings-nav" type="button" :class="{ 'is-active': tab === 'locator' }" @click="tab = 'locator'">
          <MagnusIcon name="search" :size="17" />Locator
        </button>
        <div class="mda-settings-group-label">项目</div>
        <button class="mda-settings-nav" type="button" :class="{ 'is-active': tab === 'assets' }" @click="tab = 'assets'">
          <MagnusIcon name="images" :size="17" />选区资产
        </button>
        <button class="mda-settings-nav" type="button" :class="{ 'is-active': tab === 'experiences' }" @click="tab = 'experiences'">
          <MagnusIcon name="book" :size="17" />Experience
        </button>
        <button class="mda-settings-nav" type="button" :class="{ 'is-active': tab === 'project' }" @click="tab = 'project'">
          <MagnusIcon name="folder" :size="17" />项目摘要
        </button>
        <div class="mda-settings-group-label">扩展</div>
        <button class="mda-settings-nav" type="button" :class="{ 'is-active': tab === 'tools' }" @click="tab = 'tools'">
          <MagnusIcon name="construct" :size="17" />Tools / Resources
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
          <button type="button" :class="{ 'is-active': tab === 'experiences' }" @click="tab = 'experiences'">Experience</button>
          <button type="button" :class="{ 'is-active': tab === 'tools' }" @click="tab = 'tools'">Tools</button>
          <button type="button" :class="{ 'is-active': tab === 'project' }" @click="tab = 'project'">项目摘要</button>
        </nav>

        <div v-if="memory.loading" class="mda-memory-state">正在读取记忆...</div>
        <div v-else-if="memory.error && !memory.snapshot" class="mda-memory-state is-error">
          <span>{{ memory.error }}</span>
          <button type="button" @click="memory.load">重试</button>
        </div>

        <section v-else class="mda-memory-body">
      <div v-if="memory.message || memory.error" class="mda-memory-feedback" :class="{ 'is-error': !!memory.error }">
        {{ memory.error || memory.message }}
      </div>
      <template v-if="tab === 'locator'">
        <div class="mda-locator-settings">
          <div class="mda-locator-settings-intro">
            <div>
              <strong>Locator 专用模型</strong>
              <p>可选。未配置时，{{ PRODUCT_NAME }} 只整理路由、DOM 和项目结构事实，由关联 Agent 完成源码定位和开发。</p>
            </div>
            <span :class="{ 'is-enabled': !!locatorSelectedModel }">
              {{ locatorSelectedModel ? '已启用' : '由 Agent 处理' }}
            </span>
          </div>

          <label class="mda-memory-field">
            <span>定位方式</span>
            <select :value="locatorSelectedId" @change="selectLocatorModel">
              <option value="">不使用专用模型</option>
              <option v-for="item in locatorModels" :key="item.id" :value="item.id">
                {{ item.name }} · {{ item.model }}
              </option>
            </select>
          </label>

          <div class="mda-memory-actions">
            <button type="button" @click="editLocatorModel(locatorSelectedModel)">
              {{ locatorSelectedModel ? '编辑当前模型' : '添加 DeepSeek 模型' }}
            </button>
          </div>

          <div v-if="locatorEditorExpanded" class="mda-locator-editor">
            <div class="mda-memory-section-title">模型配置</div>
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
                <span>超时 ms</span>
                <input v-model.number="locatorForm.timeoutMs" class="mda-model-input" type="number" min="5000" step="1000">
              </label>
            </div>
            <div class="mda-memory-actions">
              <button v-if="locatorSelectedModel" class="is-danger" type="button" @click="removeLocatorModel">删除</button>
              <button type="button" @click="locatorEditorExpanded = false">取消</button>
              <button class="is-primary" type="button" @click="saveLocatorModel">保存并启用</button>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="tab === 'assets'">
        <div v-if="!selectionAssets.length" class="mda-memory-empty">当前页面暂无选区资产。</div>
        <div v-else class="mda-settings-assets">
          <article v-for="asset in selectionAssets" :key="asset.uid" class="mda-settings-asset">
            <div v-if="asset.thumbnailUrl" class="mda-settings-asset-thumb" :style="assetThumbStyle(asset)" />
            <div v-else class="mda-settings-asset-thumb is-empty">{{ asset.index }}</div>
            <div class="mda-settings-asset-main">
              <strong>{{ asset.token }}</strong>
              <span>{{ asset.summary }}</span>
              <code>{{ asset.selector || asset.className || asset.text || '-' }}</code>
            </div>
          </article>
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
        <div v-if="!toolProviders.length && !resourceProviders.length && !tools.length && !resources.length" class="mda-memory-empty">当前没有可用 Tool 或 Resource。</div>
        <div v-else class="mda-memory-form">
          <div class="mda-memory-section-title">Tool Providers</div>
          <div v-for="provider in toolProviders" :key="provider.id" class="mda-memory-provider">
            <div>
              <strong>{{ provider.title || provider.id }}</strong>
              <small>{{ provider.id }} · {{ provider.source || 'builtin' }} · {{ provider.toolCount || 0 }} tools</small>
            </div>
            <p>{{ provider.description }}</p>
          </div>

          <div class="mda-memory-section-title">Tools</div>
          <div v-for="tool in tools" :key="tool.name" class="mda-memory-tool">
            <div>
              <strong>{{ tool.name }}</strong>
              <small>{{ tool.providerId || tool.source || 'builtin' }} · {{ tool.category }} · {{ tool.access }}</small>
            </div>
            <p>{{ tool.description }}</p>
          </div>

          <div class="mda-memory-section-title">Resource Providers</div>
          <div v-for="provider in resourceProviders" :key="provider.id" class="mda-memory-provider">
            <div>
              <strong>{{ provider.title || provider.id }}</strong>
              <small>{{ provider.id }} · {{ provider.source || 'builtin' }} · {{ provider.resourceCount || 0 }} resources</small>
            </div>
            <p>{{ provider.description }}</p>
          </div>

          <div class="mda-memory-section-title">Resources</div>
          <div v-for="resource in resources" :key="resource.uri" class="mda-memory-tool">
            <div>
              <strong>{{ resource.name }}</strong>
              <small>{{ resource.providerId || 'builtin' }} · {{ resource.category }} · {{ resource.mimeType }}</small>
            </div>
            <p>{{ resource.description }}</p>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="mda-memory-project-note">Project.md 由源码扫描和 Experience 索引自动生成，不在这里手工修改。</div>
        <pre class="mda-memory-project-doc">{{ memory.snapshot?.projectDocument || '暂无项目摘要。' }}</pre>
      </template>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, unref, watch } from 'vue';
import MagnusIcon from '../common/MagnusIcon.vue';
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
const initialTab = requestedSection === 'locator' ? 'locator' : 'experiences';
const tab = ref<'locator' | 'assets' | 'experiences' | 'tools' | 'project'>(initialTab);
const locatorEditorExpanded = ref(false);
const experienceId = ref('');
const experienceDraft = reactive({
  name: '',
  role: '',
  keywords: '',
  usageFiles: '',
  doc: ''
});

const experiences = computed(() => memory.snapshot?.experiences || []);
const toolProviders = computed(() => memory.toolProviders || []);
const tools = computed(() => memory.tools || []);
const resourceProviders = computed(() => memory.resourceProviders || []);
const resources = computed(() => memory.resources || []);
const locatorModels = computed(() => unref(props.modelRuntime?.modelConfigs) || []);
const locatorSelectedId = computed(() => String(unref(props.modelRuntime?.selectedModelId) || ''));
const locatorSelectedModel = computed(() => unref(props.modelRuntime?.selectedModel) || null);
const locatorForm = computed(() => unref(props.modelRuntime?.modelForm) || {});
const selectionAssets = computed(() => selectionStore.promptAssets || []);
const activeExperience = computed(() => experiences.value.find((item: any) => item.componentPath === experienceId.value) || null);
const projectLabel = computed(() => memory.snapshot?.project?.name || '当前源码项目');
const isPage = computed(() => props.mode === 'page');
const visible = computed(() => isPage.value || memory.open);
const activeTitle = computed(() => {
  if (tab.value === 'locator') return 'Locator';
  if (tab.value === 'assets') return '选区资产';
  if (tab.value === 'experiences') return 'Experience';
  if (tab.value === 'tools') return 'Tools / Resources';
  return '项目摘要';
});

function selectLocatorModel(event: Event) {
  const id = String((event.target as HTMLSelectElement)?.value || '');
  if (id) props.modelRuntime?.selectModelAndEnable?.(id);
  else props.modelRuntime?.disableModelAssist?.();
}

function editLocatorModel(model: any) {
  if (model) props.modelRuntime?.openModelEditor?.(model);
  else props.modelRuntime?.openProviderModelEditor?.('deepseek');
  locatorEditorExpanded.value = true;
}

function saveLocatorModel() {
  props.modelRuntime?.saveModelForm?.();
  locatorEditorExpanded.value = false;
}

function removeLocatorModel() {
  props.modelRuntime?.removeSelectedModel?.();
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
</script>
