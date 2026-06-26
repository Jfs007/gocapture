import type { SelectionCommandDeps } from './selection-command.deps';
import { useAppUiStore } from '../../stores/app-ui.store';

export function createRemoveSelectionUseCase(deps: SelectionCommandDeps) {
  const appUiStore = useAppUiStore();
  return async function removeSelection(uid: string) {
    if (!uid) return;
    const exists = deps.selectionStore.items.some(item => item.uid === uid);
    if (!exists) return;

    deps.bridge.sendCommand('selection.remove', { uid });
    deps.selectionStore.removeSelection(uid);
    deps.context.resetCandidateState();

    const mentionsSelection = deps.context.getComposerContent().includes('@选区');
    appUiStore.setToast(mentionsSelection
      ? '已移除选区，请检查输入框中的 @选区 引用'
      : '已移除选区');
  };
}
