<template>
  <section class="mda-composer-wrap">
    <CandidateOptions />
    <ModelEditorPanel />

    <ComposerPrebar @insert-asset="handleAssetInsert" />

    <div class="mda-composer">
      <ComposerInput ref="composerInputRef" />
      <div class="mda-composer-toolbar">
        <div class="mda-toolbar-left">
          <button
            v-if="project"
            class="mda-tool-icon-btn"
            type="button"
            title="重新选择项目"
            :disabled="sourceServiceStatus === 'loading'"
            @click="commands.selectProject"
          />
          <button v-if="selectedItems.length" class="mda-inline-text-btn" type="button" @click="commands.clearSelections">清空选区</button>
        </div>
        <div class="mda-toolbar-right">
          <ModelMenu />
          <button
            class="mda-send-btn"
            type="button"
            :class="{ 'is-stopping': modelAssistLoading }"
            :title="modelAssistLoading ? '停止模型定位' : '提交'"
            :disabled="!composerCanSend"
            @click="commands.sendRequest"
          >
            <span v-if="modelAssistLoading" class="mda-stop-icon" />
            <span v-else-if="candidateLoading">检索</span>
            <span v-else class="mda-send-arrow" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="routeResolverTrace" class="mda-route-inline">
      <span class="mda-route-label">页面源码地址</span>
      <button v-if="routeFilePath" class="mda-route-file" type="button" @click="commands.openSourceFile(routeFilePath)">
        {{ routeFilePath }}
      </button>
      <span v-else class="mda-route-empty">暂无命中</span>
      <button
        v-if="routeFilePath"
        class="mda-copy-icon"
        type="button"
        title="复制页面源码地址"
        aria-label="复制页面源码地址"
        @click="copyRouteFilePath"
      />
    </div>

    <div class="mda-toast">{{ toastText }}</div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useMagnusCommands } from '../../app/runtime/commands';
import { useAppUiStore } from '../../stores/app-ui.store';
import { useComposerStore } from '../../stores/composer.store';
import { useModelStore } from '../../stores/model.store';
import { useProjectStore } from '../../stores/project.store';
import { useRouteStore } from '../../stores/route.store';
import { useSearchStore } from '../../stores/search.store';
import { useSelectionStore } from '../../stores/selection.store';
import CandidateOptions from './CandidateOptions.vue';
import ComposerInput from './ComposerInput.vue';
import ComposerPrebar from './ComposerPrebar.vue';
import ModelMenu from './ModelMenu.vue';
import ModelEditorPanel from './ModelEditorPanel.vue';

const composerInputRef = ref(null);
const commands = useMagnusCommands();
const appUiStore = useAppUiStore();
const composerStore = useComposerStore();
const modelStore = useModelStore();
const projectStore = useProjectStore();
const routeStore = useRouteStore();
const searchStore = useSearchStore();
const selectionStore = useSelectionStore();

const candidateLoading = computed(() => searchStore.status === 'loading');
const selectedItems = computed(() => selectionStore.items);
const project = computed(() => projectStore.current);
const modelAssistLoading = computed(() => modelStore.status === 'running');
const routeResolverTrace = computed(() => routeStore.resolverTrace);
const sourceServiceStatus = computed(() => projectStore.serviceStatus);
const toastText = computed(() => appUiStore.toastText);
const composerCanSend = computed(() => {
  if (modelAssistLoading.value) return true;
  if (candidateLoading.value) return false;
  if (!project.value) return false;
  if (!selectedItems.value.length) return false;
  if (searchStore.showCandidatePicker) return searchStore.selectedCandidates.length > 0;
  return composerStore.trimmedContent.length > 0;
});

const routeHit = computed(() => {
  const trace = routeResolverTrace.value;
  if (!trace || !trace.matched || !Array.isArray(trace.hits) || !trace.hits.length) return null;
  return trace.hits[0];
});

const routeFilePath = computed(() => routeHit.value?.file || '');

defineExpose({
  focusEvidenceInput() {
    composerInputRef.value?.focusEvidenceInput?.();
  }
});

function handleAssetInsert(asset) {
  composerInputRef.value?.insertAsset?.(asset);
}

function copyRouteFilePath() {
  if (!routeFilePath.value) return;
  commands.copyText(routeFilePath.value);
}

</script>
