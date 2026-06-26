import type { MagnusRuntimeState } from './context';

export function registerRuntimeApi(api: Record<string, any>, state: Pick<MagnusRuntimeState, 'bridge' | 'selection'>) {
  const { bridge, selection } = state;
  api.start = () => bridge.sendSidePanelCommand('picker.start');
  api.stop = () => bridge.sendSidePanelCommand('picker.stop');
  api.toggle = () => bridge.sendSidePanelCommand('picker.start');
  api.clear = selection.clearSelections;
  api.getSelected = () => ({
    element: null,
    selections: selection.selectionPayloads()
  });
}
