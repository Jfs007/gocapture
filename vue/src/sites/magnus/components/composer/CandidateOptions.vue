<template>
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
          <button class="mda-file-link" type="button" @click.stop="commands.openSourceFile(hit.file)">{{ hit.file }}</button>
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
    <div class="mda-option-desc">这些候选文件缺少唯一命中文案，可能是重复复制粘贴的组件。请继续在页面上选择更外层/更独特的区域，或在输入框补充页面位置、业务模块、交互目标。</div>
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
const selectedCandidatePaths = computed(() => searchStore.selectedCandidatePaths);
const expandedCandidatePath = computed(() => searchStore.expandedCandidatePath);
const modelAssistLoading = computed(() => modelStore.status === 'running');
const collapsed = ref(false);

watch(modelAssistLoading, value => {
  if (value) collapsed.value = true;
});

function isCandidateSelected(hit) {
  return !!hit && selectedCandidatePaths.value.includes(hit.file);
}
</script>
