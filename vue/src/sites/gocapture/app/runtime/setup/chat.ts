import { watch } from 'vue';
import { useChatStore } from '../../../stores/chat.store';
import { useChatMessages } from '../../presenters/chat-messages';

export function setupChatRuntime() {
  const chatStore = useChatStore();
  const message = useChatMessages();
  watch(message.chatMessages, value => {
    chatStore.setMessages(value || []);
  }, { immediate: true });
  return message;
}
