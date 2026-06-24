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
            @click="api.chooseProject"
          />
          <button v-if="selectedItems.length" class="mda-inline-text-btn" type="button" @click="api.clearSelections">清空选区</button>
        </div>
        <div class="mda-toolbar-right">
          <ModelMenu />
          <button
            class="mda-send-btn"
            type="button"
            :class="{ 'is-stopping': modelAssistLoading }"
            :title="modelAssistLoading ? '停止模型定位' : '提交'"
            :disabled="!composerCanSend"
            @click="api.sendComposer"
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
      <button v-if="routeFilePath" class="mda-route-file" type="button" @click="api.openSourceFile(routeFilePath)">
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
import { useApi, useForm } from '../../core/ctx';
import CandidateOptions from './CandidateOptions.vue';
import ComposerInput from './ComposerInput.vue';
import ComposerPrebar from './ComposerPrebar.vue';
import ModelMenu from './ModelMenu.vue';
import ModelEditorPanel from './ModelEditorPanel.vue';

const composerInputRef = ref(null);
const api = useApi();
const candidateLoading = useForm('candidateLoading');
const selectedItems = useForm('selectedItems');
const project = useForm('project');
const modelAssistLoading = useForm('modelAssistLoading');
const routeResolverTrace = useForm('routeResolverTrace');
const sourceServiceStatus = useForm('sourceServiceStatus');
const composerCanSend = useForm('composerCanSend');
const toastText = useForm('toastText');

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
  api.copyTextWithToast(routeFilePath.value);
}

</script>
