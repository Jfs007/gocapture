<template>
  <main class="mda-root">
    <section
      class="mda-panel"
      aria-label="Magnus"
    >
      <header class="mda-head">
        <div class="mda-head-main">
          <div class="mda-title">
            <img class="mda-title-logo" :src="magnusLogo" alt="Magnus">
          </div>
          <div class="mda-subtitle">{{ pageHost }}</div>
        </div>
      </header>

      <div class="mda-body mda-chat-body">
        <input
          ref="fileInputRef"
          class="mda-file-input"
          type="file"
          webkitdirectory
          multiple
          @change="onFileInputChange"
        >
        <ChatThread />
        <ComposerPanel />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import ChatThread from '../components/chat/ChatThread.vue';
import ComposerPanel from '../components/composer/ComposerPanel.vue';
import { createMagnusRuntime } from '../app/runtime/create-runtime';
import magnusLogo from '../resources/logo.jpg';

const props = defineProps<{
  api: Record<string, any>;
}>();

const {
  fileInputRef,
  onFileInputChange,
  pageHost
} = createMagnusRuntime(props.api);
</script>
