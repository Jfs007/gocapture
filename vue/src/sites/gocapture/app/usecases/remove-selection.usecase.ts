import type { SelectionCommandDeps } from './selection-command.deps';
import { useAppUiStore } from '../../stores/app-ui.store';
import { deleteProjectSelectionReferences } from '../services/selection-reference.service';

export function createRemoveSelectionUseCase(deps: SelectionCommandDeps) {
  const appUiStore = useAppUiStore();
  return async function removeSelection(uid: string) {
    if (!uid) return;
    const selection = deps.selectionStore.items.find(item => item.uid === uid);
    if (!selection) return;

    await deleteProjectSelectionReferences(deps.context.getProjectRoot(), [uid]);
    deps.bridge.sendCommand('selection.remove', { uid }, {
      pageBindingId: selection.pageBindingId || ''
    });
    deps.selectionStore.removeSelection(uid);
    deps.context.resetCandidateState();

    const mentionsSelection = deps.context.getComposerContent().includes('@选区');
    appUiStore.setToast(mentionsSelection
      ? '已移除选区，请检查输入框中的 @选区 引用'
      : '已移除选区');
  };
}
