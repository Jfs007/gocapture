import { computed, ref } from 'vue';

export function useComposerModule({
  project,
  selectedItems,
  candidateLoading,
  modelAssistLoading,
  showCandidatePicker,
  selectedCandidateHits
}) {
  const promptText = ref('');
  const promptIntent = ref('');

  const composerEditable = computed(() => selectedItems.value.length > 0);
  const composerPlaceholder = computed(() => selectedItems.value.length
    ? '输入修改要求，可用 @选区 或 @选区1 引用已选区'
    : ''
  );
  const composerText = computed(() => {
    if (!project.value) return '请选择项目源码';
    if (!selectedItems.value.length) return '选择页面选区后，可用 @选区1 描述修改';
    return promptIntent.value;
  });
  const composerInputValue = computed(() => composerEditable.value ? promptIntent.value : composerText.value);
  const composerCanSend = computed(() => {
    if (modelAssistLoading.value) return true;
    if (candidateLoading.value) return false;
    if (!project.value) return false;
    if (!selectedItems.value.length) return false;
    if (showCandidatePicker.value) return selectedCandidateHits.value.length > 0;
    return promptIntent.value.trim().length > 0;
  });

  function invalidatePrompt() {
    promptText.value = '';
  }

  function resetPromptComposer() {
    promptText.value = '';
    promptIntent.value = '';
  }

  function setComposerValue(value) {
    if (!composerEditable.value) return String(promptIntent.value || '');
    if (promptText.value) invalidatePrompt();
    promptIntent.value = String(value || '');
    return promptIntent.value;
  }

  function onComposerInput(event) {
    setComposerValue(event?.target?.value || '');
  }

  function insertPromptAsset(token, options = {}) {
    if (!selectedItems.value.length || !token) {
      return {
        value: String(promptIntent.value || ''),
        cursor: String(promptIntent.value || '').length
      };
    }
    const nextToken = String(token).trim();
    const currentValue = String(promptIntent.value || '');
    if (!nextToken) {
      return {
        value: currentValue,
        cursor: currentValue.length
      };
    }
    const replaceMention = !!options.replaceMention;
    const start = Number.isFinite(options.replaceStart)
      ? Math.max(0, Math.min(Number(options.replaceStart), currentValue.length))
      : currentValue.length;
    const end = Number.isFinite(options.replaceEnd)
      ? Math.max(start, Math.min(Number(options.replaceEnd), currentValue.length))
      : start;
    const before = currentValue.slice(0, start);
    const after = currentValue.slice(end);
    const prefix = replaceMention || !before || /\s$/.test(before) ? '' : ' ';
    const suffix = after && /^\s/.test(after) ? '' : ' ';
    const nextValue = `${before}${prefix}${nextToken}${suffix}${after}`;
    const cursor = (before + prefix + nextToken + suffix).length;
    setComposerValue(nextValue);
    return {
      value: nextValue,
      cursor
    };
  }

  return {
    promptText,
    promptIntent,
    composerEditable,
    composerPlaceholder,
    composerInputValue,
    composerCanSend,
    invalidatePrompt,
    resetPromptComposer,
    onComposerInput,
    insertPromptAsset
  };
}
