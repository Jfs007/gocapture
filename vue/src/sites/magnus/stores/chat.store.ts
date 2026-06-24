import { ref } from 'vue';
import { defineStore } from 'pinia';

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'agent';
  title?: string;
  text?: string;
  pre?: string;
  logs?: string[];
  [key: string]: unknown;
}

export const useChatStore = defineStore('magnus.chat', () => {
  const messages = ref<ChatMessage[]>([]);

  function setMessages(nextMessages: ChatMessage[]) {
    messages.value = Array.isArray(nextMessages) ? nextMessages : [];
  }

  function append(message: ChatMessage) {
    messages.value.push(message);
  }

  function clear() {
    messages.value = [];
  }

  return {
    messages,
    setMessages,
    append,
    clear
  };
});
