<template>
  <section class="mda-composer-wrap">
    <div class="mda-result-module">
      <div v-if="hasResultModule" class="mda-result-module-head">
        <span class="mda-result-module-title">定位与修改计划</span>
        <button class="mda-collapse-btn" type="button" @click="resultModuleCollapsed = !resultModuleCollapsed">
          {{ resultModuleCollapsed ? '展开' : '收起' }}
        </button>
      </div>
      <div v-show="!(hasResultModule && resultModuleCollapsed)" class="mda-result-module-body">
        <CandidateOptions />
        <ComposerPrebar @insert-asset="handleAssetInsert" />
      </div>
    </div>

    <div class="mda-composer">
      <ComposerInput ref="composerInputRef" />
      <div class="mda-composer-toolbar">
        <div class="mda-toolbar-left">
          <button v-if="selectedItems.length" class="mda-inline-text-btn" type="button" @click="commands.clearSelections">清空选区</button>
          <span class="mda-build-version" :title="`构建版本 ${buildVersion}`">build {{ buildVersion }}</span>
        </div>
        <div class="mda-toolbar-right">
          <button
            class="mda-send-btn"
            type="button"
            :class="{ 'is-stopping': modelAssistLoading || connectAgentStore.taskRunning }"
            :title="modelAssistLoading || connectAgentStore.taskRunning ? '停止当前任务' : '提交'"
            :disabled="!composerCanSend"
            @click="commands.sendRequest"
          >
            <span v-if="modelAssistLoading || connectAgentStore.taskRunning" class="mda-stop-icon" />
            <span v-else-if="candidateLoading">检索</span>
            <span v-else class="mda-send-arrow" />
          </button>
        </div>
      </div>
    </div>

    <div class="mda-route-inline">
      <template v-if="routeResolverTrace">
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
      </template>
      <span v-if="toastText" class="mda-toast">{{ toastText }}</span>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useGoCaptureCommands } from '../../app/runtime/commands';
import { useAppUiStore } from '../../stores/app-ui.store';
import { useComposerStore } from '../../stores/composer.store';
import { useConnectAgentStore } from '../../stores/connect-agent.store';
import { useModelStore } from '../../stores/model.store';
import { useProjectStore } from '../../stores/project.store';
import { useRouteStore } from '../../stores/route.store';
import { useSearchStore } from '../../stores/search.store';
import { useSelectionStore } from '../../stores/selection.store';
import CandidateOptions from './CandidateOptions.vue';
import ComposerInput from './ComposerInput.vue';
import ComposerPrebar from './ComposerPrebar.vue';

const composerInputRef = ref(null);
// 构建版本号（构建时由 app-build.js 通过 vite define 注入）。用于判断当前扩展加载的是不是最新 bundle。
const buildVersion = typeof __GOCAPTURE_BUILD_VERSION__ !== 'undefined' ? __GOCAPTURE_BUILD_VERSION__ : 'dev';
const commands = useGoCaptureCommands();
const appUiStore = useAppUiStore();
const composerStore = useComposerStore();
const connectAgentStore = useConnectAgentStore();
const modelStore = useModelStore();
const projectStore = useProjectStore();
const routeStore = useRouteStore();
const searchStore = useSearchStore();
const selectionStore = useSelectionStore();

const candidateLoading = computed(() => searchStore.status === 'loading');
const resultModuleCollapsed = ref(false);
// 有定位/组合/修改计划结果时，才显示「整块收起」头部（prebar 在无结果时仍正常展示）。
const hasResultModule = computed(() =>
  (searchStore.candidates?.length || 0) > 0 || !!searchStore.composite || !!searchStore.changePlan);
const selectedItems = computed(() => selectionStore.items);
const project = computed(() => projectStore.current);
const modelAssistLoading = computed(() => modelStore.status === 'running');
const routeResolverTrace = computed(() => routeStore.resolverTrace);
const toastText = computed(() => appUiStore.toastText);
const composerCanSend = computed(() => {
  if (modelAssistLoading.value || connectAgentStore.taskRunning) return true;
  if (candidateLoading.value) return false;
  if (!project.value) return false;
  if (!connectAgentStore.activeProvider?.connected) return false;
  if (connectAgentStore.activeProvider.requiresThreadBinding
    && !connectAgentStore.activeProvider.projectThreadId) return false;
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
