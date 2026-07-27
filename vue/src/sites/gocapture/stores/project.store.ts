import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { SourceProject, SourceServiceStatus } from '../app/types/source-project.types';

export const useProjectStore = defineStore('gocapture.project', () => {
  const current = ref<SourceProject | null>(null);
  const serviceStatus = ref<SourceServiceStatus>('idle');
  const serviceError = ref('');
  const serviceMessage = ref('');
  const pageContext = ref<unknown>(null);

  function setProject(project: SourceProject | null) {
    current.value = project;
  }

  function setServiceStatus(status: SourceServiceStatus, message = '', error = '') {
    serviceStatus.value = status;
    serviceMessage.value = message;
    serviceError.value = error;
  }

  function setPageContext(value: unknown) {
    pageContext.value = value || null;
  }

  return {
    current,
    pageContext,
    serviceStatus,
    serviceError,
    serviceMessage,
    setProject,
    setServiceStatus,
    setPageContext
  };
});
