import type { MagnusModules } from './context';

export function registerRuntimeApi(api: Record<string, any>, modules: Pick<MagnusModules, 'bridge' | 'selection'>) {
  const { bridge, selection } = modules;
  api.start = () => bridge.sendSidePanelCommand('picker.start');
  api.stop = () => bridge.sendSidePanelCommand('picker.stop');
  api.toggle = () => bridge.sendSidePanelCommand('picker.start');
  api.clear = selection.clearSelections;
  api.getSelected = () => ({
    element: null,
    selections: selection.selectionPayloads()
  });
}
