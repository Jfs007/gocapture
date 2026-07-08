import { useSelectionStore } from '../../../stores/selection.store';
import { useComposerStore } from '../../../stores/composer.store';
import { useModelStore } from '../../../stores/model.store';
import { useSearchStore } from '../../../stores/search.store';
import { createClearSelectionsUseCase } from '../../usecases/clear-selections.usecase';
import { createExpandSelectionUseCase } from '../../usecases/expand-selection.usecase';
import { createPreviewSelectionUseCase } from '../../usecases/preview-selection.usecase';
import { createRemoveSelectionUseCase } from '../../usecases/remove-selection.usecase';
import type { SelectionCommandDeps } from '../../usecases/selection-command.deps';
import { createSelectionFacade } from '../../state/selection.facade';

interface SelectionRuntimeOptions {
  sendCommand: (type: string, payload?: unknown, options?: { pageBindingId?: string }) => void;
}

export function setupSelectionRuntime(options: SelectionRuntimeOptions) {
  const selectionStore = useSelectionStore();
  const composerStore = useComposerStore();
  const searchStore = useSearchStore();
  const modelStore = useModelStore();
  const selection: any = createSelectionFacade(selectionStore);
  const deps: SelectionCommandDeps = {
    bridge: { sendCommand: options.sendCommand },
    selectionStore,
    context: {
      resetComposer: () => {
        composerStore.setFinalPrompt('');
        composerStore.clearContent();
      },
      resetCandidateState: () => {
        selectionStore.filesConfirmed = false;
        searchStore.reset();
        modelStore.reset();
        composerStore.setFinalPrompt('');
      },
      getComposerContent: () => composerStore.content || ''
    }
  };
  const preview = createPreviewSelectionUseCase(deps);
  Object.assign(selection, {
    expandSelection: createExpandSelectionUseCase(deps),
    removeSelection: createRemoveSelectionUseCase(deps),
    clearSelections: createClearSelectionsUseCase(deps),
    previewSelection: preview.previewSelection,
    restoreSelectionPreview: preview.restoreSelectionPreview
  });
  return selection;
}
