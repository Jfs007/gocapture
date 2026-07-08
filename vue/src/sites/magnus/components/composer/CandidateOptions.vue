<template>
  <div v-if="composite" class="mda-composer-options mda-composite">
    <div class="mda-option-title">源码组合定位</div>
    <div class="mda-composite-row">
      <span class="mda-composite-tag mda-composite-render">主渲染</span>
      <button class="mda-file-link" type="button" @click="commands.openSourceFile(composite.render.file, composite.render.line, composite.render.column)">
        {{ composite.render.file }}<span v-if="composite.render.line" class="mda-composite-line">:{{ composite.render.line }}</span>
      </button>
    </div>
    <div v-if="composite.assembly" class="mda-composite-row">
      <span class="mda-composite-tag">装配</span>
      <button class="mda-file-link" type="button" @click="commands.openSourceFile(composite.assembly.file)">{{ composite.assembly.file }}</button>
    </div>
    <div v-for="co in composite.coRenders || []" :key="`co-${co.file}`" class="mda-composite-row">
      <span class="mda-composite-tag mda-composite-render">并列渲染</span>
      <button class="mda-file-link" type="button" @click="commands.openSourceFile(co.file)">{{ co.file }}</button>
    </div>
    <div v-for="child in composite.children || []" :key="`child-${child.file}`" class="mda-composite-row">
      <span class="mda-composite-tag">子组件</span>
      <button class="mda-file-link" type="button" @click="commands.openSourceFile(child.file)">{{ child.file }}</button>
      <span v-if="child.anchor" class="mda-composite-anchor">{{ child.anchor }}</span>
    </div>
  </div>

  <div v-if="hasChangePlanContent" class="mda-composer-options mda-plan">
    <div class="mda-option-title">修改计划</div>
    <div class="mda-plan-body">
    <div v-if="changePlan.summary" class="mda-plan-summary">{{ changePlan.summary }}</div>
    <div v-if="(changePlan.targets || []).length" class="mda-plan-block">
      <div class="mda-plan-block-title">改动点</div>
      <div v-for="(target, index) in changePlan.targets" :key="`t-${index}`" class="mda-plan-target">
        <button class="mda-file-link" type="button" @click="commands.openSourceFile(target.file, target.line)">
          {{ target.file }}<span v-if="target.line" class="mda-composite-line">:{{ target.line }}</span>
        </button>
        <span v-if="target.anchor" class="mda-composite-anchor">{{ target.anchor }}</span>
        <div v-if="target.whatToChange" class="mda-plan-what">改：{{ target.whatToChange }}</div>
        <div v-if="target.why" class="mda-plan-why">因：{{ target.why }}</div>
      </div>
    </div>
    <div v-if="(changePlan.affected || []).length" class="mda-plan-block">
      <div class="mda-plan-block-title">连带影响</div>
      <div v-for="(item, index) in changePlan.affected" :key="`a-${index}`" class="mda-plan-line">
        <button class="mda-file-link" type="button" @click="commands.openSourceFile(item.file)">{{ item.file }}</button>
        <span class="mda-composite-anchor">{{ item.reason }}</span>
      </div>
    </div>
    <div v-for="section in plainPlanSections" :key="section.key" class="mda-plan-block">
      <template v-if="(changePlan[section.key] || []).length">
        <div class="mda-plan-block-title">{{ section.label }}</div>
        <div v-for="(line, index) in changePlan[section.key]" :key="`${section.key}-${index}`" class="mda-plan-line">· {{ line }}</div>
      </template>
    </div>
    <div v-if="openQuestions.length" class="mda-plan-block">
      <div class="mda-plan-block-title">待确认</div>
      <label
        v-for="(line, index) in openQuestions"
        :key="`open-${index}-${line}`"
        class="mda-plan-check"
        :class="{ 'is-checked': isQuestionChecked(line) }"
      >
        <input type="checkbox" :checked="isQuestionChecked(line)" @change="toggleQuestion(line)">
        <span>{{ line }}</span>
      </label>
    </div>
    </div>
  </div>

  <div v-if="showCandidatePicker" class="mda-composer-options">
    <div class="mda-collapsible-head">
      <div class="mda-option-title">存在多个命中文件，请确认</div>
      <button class="mda-collapse-btn" type="button" @click="collapsed = !collapsed">
        {{ collapsed ? '展开' : '收起' }}
      </button>
    </div>
    <div v-if="collapsed" class="mda-collapsed-summary">
      已选 {{ selectedCandidatePaths.length || 0 }} / {{ candidateHits.length }} 个文件
    </div>
    <div v-else class="mda-choice-list">
      <article
        v-for="hit in candidateHits"
        :key="hit.file"
        class="mda-choice-card"
        :class="{ 'is-selected': isCandidateSelected(hit) }"
      >
        <div class="mda-choice-check">
          <input type="checkbox" :checked="isCandidateSelected(hit)" @change="commands.toggleCandidateFile(hit)">
          <button class="mda-file-link" type="button" @click.stop="commands.openSourceFile(hit.file, hit.line, hit.column)">
            {{ hit.file }}<span v-if="hit.line" class="mda-composite-line">:{{ hit.line }}</span>
          </button>
        </div>
        <div class="mda-choice-meta">{{ candidateStageLabel(hit) }} · {{ hit.score }}</div>
        <button class="mda-link-btn" type="button" @click="commands.toggleCandidateDetail(hit)">
          {{ expandedCandidatePath === hit.file ? '收起' : candidateDetailTitle(hit) }}
        </button>
        <pre v-if="expandedCandidatePath === hit.file" class="mda-candidate-log">{{ candidateLogText(hit) }}</pre>
      </article>
    </div>
  </div>

  <div v-if="needsMoreEvidence" class="mda-composer-options">
    <div class="mda-option-title">线索不足，需要补充页面证据</div>
    <div class="mda-option-desc">当前选区缺少稳定源码锚点，系统已基于当前选区自动扩区并继续检索。若仍未定位，说明当前 DOM 链路没有足够稳定证据。</div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { candidateDetailTitle, candidateLogText, candidateStageLabel } from '../../app/presenters/candidate-presenter';
import { useMagnusCommands } from '../../app/runtime/commands';
import { useModelStore } from '../../stores/model.store';
import { useSearchStore } from '../../stores/search.store';

const commands = useMagnusCommands();
const searchStore = useSearchStore();
const modelStore = useModelStore();
const showCandidatePicker = computed(() => searchStore.showCandidatePicker);
const needsMoreEvidence = computed(() => searchStore.needsMoreEvidence);
const candidateHits = computed(() => searchStore.candidates);
const composite = computed(() => searchStore.composite);
const changePlan = computed(() => searchStore.changePlan);
const checkedQuestions = ref([]);
const hasChangePlanContent = computed(() => {
  const plan = changePlan.value;
  if (!plan) return false;
  return !!(
    plan.summary
    || (plan.targets || []).length
    || (plan.affected || []).length
    || (plan.reusePatterns || []).length
    || (plan.risks || []).length
    || (plan.verification || []).length
    || (plan.openQuestions || []).length
  );
});
const plainPlanSections = [
  { key: 'reusePatterns', label: '可复用模式' },
  { key: 'risks', label: '风险' },
  { key: 'verification', label: '验证' }
];
const openQuestions = computed(() => Array.isArray(changePlan.value?.openQuestions) ? changePlan.value.openQuestions : []);
const selectedCandidatePaths = computed(() => searchStore.selectedCandidatePaths);
const expandedCandidatePath = computed(() => searchStore.expandedCandidatePath);
const modelAssistLoading = computed(() => modelStore.status === 'running');
const collapsed = ref(false);

watch(modelAssistLoading, value => {
  if (value) collapsed.value = true;
});

watch(openQuestions, questions => {
  const allowed = new Set(questions);
  checkedQuestions.value = checkedQuestions.value.filter(item => allowed.has(item));
}, { immediate: true });

function isCandidateSelected(hit) {
  return !!hit && selectedCandidatePaths.value.includes(hit.file);
}

function isQuestionChecked(line) {
  return checkedQuestions.value.includes(line);
}

function toggleQuestion(line) {
  if (isQuestionChecked(line)) {
    checkedQuestions.value = checkedQuestions.value.filter(item => item !== line);
    return;
  }
  checkedQuestions.value = [...checkedQuestions.value, line];
}
</script>
