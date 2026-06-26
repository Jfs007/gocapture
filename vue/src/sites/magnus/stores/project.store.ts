import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { SourceProject, SourceServiceStatus } from '../app/types/source-project.types';

export const useProjectStore = defineStore('magnus.project', () => {
  const current = ref<SourceProject | null>(null);
  const serviceStatus = ref<SourceServiceStatus>('idle');
  const serviceError = ref('');
  const serviceMessage = ref('');

  function setProject(project: SourceProject | null) {
    current.value = project;
  }

  function setServiceStatus(status: SourceServiceStatus, message = '', error = '') {
    serviceStatus.value = status;
    serviceMessage.value = message;
    serviceError.value = error;
  }

  return {
    current,
    serviceStatus,
    serviceError,
    serviceMessage,
    setProject,
    setServiceStatus
  };
});
