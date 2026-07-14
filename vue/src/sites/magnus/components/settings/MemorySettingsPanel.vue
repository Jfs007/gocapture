<template>
  <div v-if="visible" class="mda-memory-shell" :class="{ 'is-page': isPage }" role="dialog" aria-modal="true" aria-label="Magnus 设置">
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
          <span>返回 Magnus</span>
        </button>
        <label class="mda-settings-search">
          <MagnusIcon name="search" :size="17" />
          <input type="text" placeholder="搜索设置..." disabled>
        </label>
        <div class="mda-settings-group-label">项目</div>
        <button class="mda-settings-nav" type="button" :class="{ 'is-active': tab === 'sessions' }" @click="tab = 'sessions'">
          <MagnusIcon name="albums" :size="17" />任务记忆
        </button>
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
            <span>Magnus 设置</span>
            <strong>{{ activeTitle }}</strong>
            <em>{{ projectLabel }}</em>
          </div>
          <button class="mda-settings-primary" type="button" @click="$emit('select-project')">选择源码</button>
        </header>

        <nav v-if="!isPage" class="mda-memory-tabs" aria-label="记忆类型">
          <button type="button" :class="{ 'is-active': tab === 'sessions' }" @click="tab = 'sessions'">任务会话</button>
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
      <template v-if="tab === 'sessions'">
        <div v-if="!sessions.length" class="mda-memory-empty">当前项目暂无活跃任务会话。</div>
        <template v-else>
          <label class="mda-memory-field">
            <span>页面会话</span>
            <select v-model="sessionId">
              <option v-for="session in sessions" :key="session.id" :value="session.id">
                {{ session.pageKey }} · {{ formatTime(session.updatedAt) }}
              </option>
            </select>
          </label>
          <div v-if="activeSession" class="mda-memory-form">
            <label class="mda-memory-field">
              <span>累计需求 <small>每行一条</small></span>
              <textarea v-model="sessionDraft.requirements" rows="5" />
            </label>
            <label class="mda-memory-field">
              <span>目标文件 <small>每行一个</small></span>
              <textarea v-model="sessionDraft.targetFiles" rows="3" />
            </label>
            <label class="mda-memory-field">
              <span>已确认 Experience <small>每行一个 Experience ID</small></span>
              <textarea v-model="sessionDraft.confirmedExperienceIds" rows="3" />
            </label>
            <label class="mda-memory-field">
              <span>已确认事实 <small>每行一条</small></span>
              <textarea v-model="sessionDraft.confirmedFacts" rows="4" />
            </label>
            <label class="mda-memory-field">
              <span>待确认假设 <small>每行一条</small></span>
              <textarea v-model="sessionDraft.assumptions" rows="4" />
            </label>
            <label class="mda-memory-field">
              <span>上一版增强提示词</span>
              <textarea v-model="sessionDraft.lastEnhancedPrompt" rows="10" class="is-code" />
            </label>
            <div class="mda-memory-actions">
              <button class="is-danger" type="button" :disabled="memory.saving" @click="removeSession">清除此会话</button>
              <button class="is-primary" type="button" :disabled="memory.saving" @click="saveSession">
                {{ memory.saving ? '保存中...' : '保存会话' }}
              </button>
            </div>
          </div>
        </template>
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
              <option v-for="experience in experiences" :key="experience.meta.id" :value="experience.meta.id">
                {{ experience.meta.name }} · {{ experience.meta.status }}
              </option>
            </select>
          </label>
          <div v-if="activeExperience" class="mda-memory-form">
            <label class="mda-memory-field">
              <span>名称</span>
              <input v-model="experienceDraft.name" type="text">
            </label>
            <div class="mda-memory-row">
              <label class="mda-memory-field">
                <span>状态</span>
                <select v-model="experienceDraft.status">
                  <option value="active">active</option>
                  <option value="needs-verification">needs-verification</option>
                  <option value="stale">stale</option>
                </select>
              </label>
              <label class="mda-memory-field">
                <span>置信度</span>
                <select v-model="experienceDraft.confidence">
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>
            </div>
            <label class="mda-memory-field">
              <span>触发标签 <small>每行一个</small></span>
              <textarea v-model="experienceDraft.triggerTags" rows="3" />
            </label>
            <label class="mda-memory-field">
              <span>适用条件 <small>每行一条</small></span>
              <textarea v-model="experienceDraft.applicableWhen" rows="4" />
            </label>
            <label class="mda-memory-field">
              <span>不适用条件 <small>每行一条</small></span>
              <textarea v-model="experienceDraft.notApplicableWhen" rows="4" />
            </label>
            <label class="mda-memory-field">
              <span>Experience 正文 <small>Markdown</small></span>
              <textarea v-model="experienceDraft.context" rows="14" class="is-code" />
            </label>
            <details class="mda-memory-advanced">
              <summary>结构化约束</summary>
              <label class="mda-memory-field">
                <span>Recipes JSON</span>
                <textarea v-model="experienceDraft.recipes" rows="8" class="is-code" />
              </label>
              <label class="mda-memory-field">
                <span>Source contracts JSON</span>
                <textarea v-model="experienceDraft.sourceContracts" rows="8" class="is-code" />
              </label>
              <label class="mda-memory-field">
                <span>Checklist JSON</span>
                <textarea v-model="experienceDraft.verificationChecklist" rows="8" class="is-code" />
              </label>
            </details>
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
import { computed, reactive, ref, watch } from 'vue';
import MagnusIcon from '../common/MagnusIcon.vue';
import { useAppUiStore } from '../../stores/app-ui.store';
import { useMemoryStore } from '../../stores/memory.store';
import { useSelectionStore } from '../../stores/selection.store';

const props = withDefaults(defineProps<{
  mode?: 'panel' | 'page';
}>(), {
  mode: 'panel'
});
defineEmits<{
  (event: 'back'): void;
  (event: 'select-project'): void;
}>();

const memory = useMemoryStore();
const appUi = useAppUiStore();
const selectionStore = useSelectionStore();
const tab = ref<'sessions' | 'assets' | 'experiences' | 'tools' | 'project'>('sessions');
const sessionId = ref('');
const experienceId = ref('');
const sessionDraft = reactive({
  requirements: '',
  targetFiles: '',
  confirmedExperienceIds: '',
  confirmedFacts: '',
  assumptions: '',
  lastEnhancedPrompt: ''
});
const experienceDraft = reactive({
  name: '',
  status: 'needs-verification',
  confidence: 'medium',
  triggerTags: '',
  applicableWhen: '',
  notApplicableWhen: '',
  context: '',
  recipes: '[]',
  sourceContracts: '[]',
  verificationChecklist: '[]'
});

const sessions = computed(() => memory.snapshot?.taskSessions || []);
const experiences = computed(() => memory.snapshot?.experiences || []);
const toolProviders = computed(() => memory.toolProviders || []);
const tools = computed(() => memory.tools || []);
const resourceProviders = computed(() => memory.resourceProviders || []);
const resources = computed(() => memory.resources || []);
const selectionAssets = computed(() => selectionStore.promptAssets || []);
const activeSession = computed(() => sessions.value.find((item: any) => item.id === sessionId.value) || null);
const activeExperience = computed(() => experiences.value.find((item: any) => item.meta?.id === experienceId.value) || null);
const projectLabel = computed(() => memory.snapshot?.project?.name || '当前源码项目');
const isPage = computed(() => props.mode === 'page');
const visible = computed(() => isPage.value || memory.open);
const activeTitle = computed(() => {
  if (tab.value === 'sessions') return '任务记忆';
  if (tab.value === 'assets') return '选区资产';
  if (tab.value === 'experiences') return 'Experience';
  if (tab.value === 'tools') return 'Tools / Resources';
  return '项目摘要';
});

watch(sessions, value => {
  if (!value.some((item: any) => item.id === sessionId.value)) sessionId.value = value[0]?.id || '';
}, { immediate: true });

watch(experiences, value => {
  if (!value.some((item: any) => item.meta?.id === experienceId.value)) experienceId.value = value[0]?.meta?.id || '';
}, { immediate: true });

watch(activeSession, session => {
  if (!session) return;
  sessionDraft.requirements = toLines(session.requirements);
  sessionDraft.targetFiles = toLines(session.targetFiles);
  sessionDraft.confirmedExperienceIds = toLines(session.confirmedExperienceIds);
  sessionDraft.confirmedFacts = toLines(session.confirmedFacts);
  sessionDraft.assumptions = toLines(session.assumptions);
  sessionDraft.lastEnhancedPrompt = session.lastEnhancedPrompt || '';
}, { immediate: true });

watch(activeExperience, experience => {
  if (!experience) return;
  experienceDraft.name = experience.meta?.name || '';
  experienceDraft.status = experience.meta?.status || 'needs-verification';
  experienceDraft.confidence = experience.meta?.confidence || 'medium';
  experienceDraft.triggerTags = toLines(experience.meta?.triggerTags);
  experienceDraft.applicableWhen = toLines(experience.meta?.applicableWhen);
  experienceDraft.notApplicableWhen = toLines(experience.meta?.notApplicableWhen);
  experienceDraft.context = experience.context || '';
  experienceDraft.recipes = formatJson(experience.recipes);
  experienceDraft.sourceContracts = formatJson(experience.sourceContracts);
  experienceDraft.verificationChecklist = formatJson(experience.verificationChecklist);
}, { immediate: true });

function toLines(value: unknown) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function fromLines(value: string) {
  return value.split('\n').map(item => item.trim()).filter(Boolean);
}

function formatJson(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2);
}

function parseJsonArray(value: string, label: string) {
  const parsed = JSON.parse(value || '[]');
  if (!Array.isArray(parsed)) throw new Error(`${label} 必须是 JSON 数组`);
  return parsed;
}

async function saveSession() {
  if (!activeSession.value) return;
  const ok = await memory.saveSession({
    id: activeSession.value.id,
    requirements: fromLines(sessionDraft.requirements),
    targetFiles: fromLines(sessionDraft.targetFiles),
    confirmedExperienceIds: fromLines(sessionDraft.confirmedExperienceIds),
    confirmedFacts: fromLines(sessionDraft.confirmedFacts),
    assumptions: fromLines(sessionDraft.assumptions),
    lastEnhancedPrompt: sessionDraft.lastEnhancedPrompt
  });
  if (ok) appUi.setToast('任务会话已保存');
}

async function removeSession() {
  if (!activeSession.value) return;
  const ok = await memory.removeSession(activeSession.value.id);
  if (ok) appUi.setToast('任务会话已清除');
}

async function saveExperience() {
  if (!activeExperience.value) return;
  try {
    const ok = await memory.saveExperience({
      id: activeExperience.value.meta.id,
      name: experienceDraft.name,
      status: experienceDraft.status,
      confidence: experienceDraft.confidence,
      triggerTags: fromLines(experienceDraft.triggerTags),
      applicableWhen: fromLines(experienceDraft.applicableWhen),
      notApplicableWhen: fromLines(experienceDraft.notApplicableWhen),
      context: experienceDraft.context,
      recipes: parseJsonArray(experienceDraft.recipes, 'Recipes'),
      sourceContracts: parseJsonArray(experienceDraft.sourceContracts, 'Source contracts'),
      verificationChecklist: parseJsonArray(experienceDraft.verificationChecklist, 'Checklist')
    });
    if (ok) appUi.setToast('Experience 已保存');
  } catch (cause: any) {
    memory.error = cause?.message || '结构化约束格式错误';
  }
}

function formatTime(value: number) {
  return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

function assetThumbStyle(asset: any) {
  return asset?.thumbnailUrl ? { backgroundImage: `url("${asset.thumbnailUrl}")` } : {};
}
</script>
