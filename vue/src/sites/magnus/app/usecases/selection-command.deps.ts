import type { useSelectionStore } from '../../stores/selection.store';

export type SelectionStore = ReturnType<typeof useSelectionStore>;

/**
 * Side-effecting selection commands depend on real collaborators only:
 *  - bridge: the runtime command channel (infrastructure)
 *  - selectionStore: the single source of truth for selection state
 *
 * `context` holds cross-domain reset/read helpers used by selection commands.
 * Keep them isolated here so selection use-cases do not grow hidden imports.
 */
export interface SelectionCommandDeps {
  bridge: {
    sendCommand: (type: string, payload?: unknown, options?: { pageBindingId?: string }) => void;
  };
  selectionStore: SelectionStore;
  context: {
    resetComposer: () => void;
    resetCandidateState: () => void;
    getComposerContent: () => string;
  };
}
