<template>
  <div v-if="memory.open" class="mda-memory-shell" role="dialog" aria-modal="true" aria-label="Magnus 记忆设置">
    <header class="mda-memory-head">
      <div>
        <strong>记忆设置</strong>
        <span>{{ projectLabel }}</span>
      </div>
      <button class="mda-icon mda-memory-close" type="button" title="关闭" aria-label="关闭" @click="memory.closePanel">×</button>
    </header>

    <nav class="mda-memory-tabs" aria-label="记忆类型">
      <button type="button" :class="{ 'is-active': tab === 'sessions' }" @click="tab = 'sessions'">任务会话</button>
      <button type="button" :class="{ 'is-active': tab === 'skills' }" @click="tab = 'skills'">项目经验</button>
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
              <span>已确认项目经验 <small>每行一个 Skill ID</small></span>
              <textarea v-model="sessionDraft.confirmedSkillIds" rows="3" />
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

      <template v-else-if="tab === 'skills'">
        <div v-if="!skills.length" class="mda-memory-empty">当前项目暂无已保存经验。</div>
        <template v-else>
          <label class="mda-memory-field">
            <span>项目经验</span>
            <select v-model="skillId">
              <option v-for="skill in skills" :key="skill.meta.id" :value="skill.meta.id">
                {{ skill.meta.name }} · {{ skill.meta.status }}
              </option>
            </select>
          </label>
          <div v-if="activeSkill" class="mda-memory-form">
            <label class="mda-memory-field">
              <span>名称</span>
              <input v-model="skillDraft.name" type="text">
            </label>
            <div class="mda-memory-row">
              <label class="mda-memory-field">
                <span>状态</span>
                <select v-model="skillDraft.status">
                  <option value="active">active</option>
                  <option value="needs-verification">needs-verification</option>
                  <option value="stale">stale</option>
                </select>
              </label>
              <label class="mda-memory-field">
                <span>置信度</span>
                <select v-model="skillDraft.confidence">
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>
            </div>
            <label class="mda-memory-field">
              <span>触发标签 <small>每行一个</small></span>
              <textarea v-model="skillDraft.triggerTags" rows="3" />
            </label>
            <label class="mda-memory-field">
              <span>适用条件 <small>每行一条</small></span>
              <textarea v-model="skillDraft.applicableWhen" rows="4" />
            </label>
            <label class="mda-memory-field">
              <span>不适用条件 <small>每行一条</small></span>
              <textarea v-model="skillDraft.notApplicableWhen" rows="4" />
            </label>
            <label class="mda-memory-field">
              <span>经验正文 <small>Markdown</small></span>
              <textarea v-model="skillDraft.context" rows="14" class="is-code" />
            </label>
            <details class="mda-memory-advanced">
              <summary>结构化约束</summary>
              <label class="mda-memory-field">
                <span>Recipes JSON</span>
                <textarea v-model="skillDraft.recipes" rows="8" class="is-code" />
              </label>
              <label class="mda-memory-field">
                <span>Source contracts JSON</span>
                <textarea v-model="skillDraft.sourceContracts" rows="8" class="is-code" />
              </label>
              <label class="mda-memory-field">
                <span>Checklist JSON</span>
                <textarea v-model="skillDraft.verificationChecklist" rows="8" class="is-code" />
              </label>
            </details>
            <div class="mda-memory-actions">
              <button class="is-primary" type="button" :disabled="memory.saving" @click="saveSkill">
                {{ memory.saving ? '保存中...' : '保存经验' }}
              </button>
            </div>
          </div>
        </template>
      </template>

      <template v-else>
        <div class="mda-memory-project-note">Project.md 由源码扫描和项目经验索引自动生成，不在这里手工修改。</div>
        <pre class="mda-memory-project-doc">{{ memory.snapshot?.projectDocument || '暂无项目摘要。' }}</pre>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useAppUiStore } from '../../stores/app-ui.store';
import { useMemoryStore } from '../../stores/memory.store';

const memory = useMemoryStore();
const appUi = useAppUiStore();
const tab = ref<'sessions' | 'skills' | 'project'>('sessions');
const sessionId = ref('');
const skillId = ref('');
const sessionDraft = reactive({
  requirements: '',
  targetFiles: '',
  confirmedSkillIds: '',
  confirmedFacts: '',
  assumptions: '',
  lastEnhancedPrompt: ''
});
const skillDraft = reactive({
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
const skills = computed(() => memory.snapshot?.skills || []);
const activeSession = computed(() => sessions.value.find((item: any) => item.id === sessionId.value) || null);
const activeSkill = computed(() => skills.value.find((item: any) => item.meta?.id === skillId.value) || null);
const projectLabel = computed(() => memory.snapshot?.project?.name || '当前源码项目');

watch(sessions, value => {
  if (!value.some((item: any) => item.id === sessionId.value)) sessionId.value = value[0]?.id || '';
}, { immediate: true });

watch(skills, value => {
  if (!value.some((item: any) => item.meta?.id === skillId.value)) skillId.value = value[0]?.meta?.id || '';
}, { immediate: true });

watch(activeSession, session => {
  if (!session) return;
  sessionDraft.requirements = toLines(session.requirements);
  sessionDraft.targetFiles = toLines(session.targetFiles);
  sessionDraft.confirmedSkillIds = toLines(session.confirmedSkillIds);
  sessionDraft.confirmedFacts = toLines(session.confirmedFacts);
  sessionDraft.assumptions = toLines(session.assumptions);
  sessionDraft.lastEnhancedPrompt = session.lastEnhancedPrompt || '';
}, { immediate: true });

watch(activeSkill, skill => {
  if (!skill) return;
  skillDraft.name = skill.meta?.name || '';
  skillDraft.status = skill.meta?.status || 'needs-verification';
  skillDraft.confidence = skill.meta?.confidence || 'medium';
  skillDraft.triggerTags = toLines(skill.meta?.triggerTags);
  skillDraft.applicableWhen = toLines(skill.meta?.applicableWhen);
  skillDraft.notApplicableWhen = toLines(skill.meta?.notApplicableWhen);
  skillDraft.context = skill.context || '';
  skillDraft.recipes = formatJson(skill.recipes);
  skillDraft.sourceContracts = formatJson(skill.sourceContracts);
  skillDraft.verificationChecklist = formatJson(skill.verificationChecklist);
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
    confirmedSkillIds: fromLines(sessionDraft.confirmedSkillIds),
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

async function saveSkill() {
  if (!activeSkill.value) return;
  try {
    const ok = await memory.saveSkill({
      id: activeSkill.value.meta.id,
      name: skillDraft.name,
      status: skillDraft.status,
      confidence: skillDraft.confidence,
      triggerTags: fromLines(skillDraft.triggerTags),
      applicableWhen: fromLines(skillDraft.applicableWhen),
      notApplicableWhen: fromLines(skillDraft.notApplicableWhen),
      context: skillDraft.context,
      recipes: parseJsonArray(skillDraft.recipes, 'Recipes'),
      sourceContracts: parseJsonArray(skillDraft.sourceContracts, 'Source contracts'),
      verificationChecklist: parseJsonArray(skillDraft.verificationChecklist, 'Checklist')
    });
    if (ok) appUi.setToast('项目经验已保存');
  } catch (cause: any) {
    memory.error = cause?.message || '结构化约束格式错误';
  }
}

function formatTime(value: number) {
  return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}
</script>
