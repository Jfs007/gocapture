export function registerRuntimeApi(api, bridge, selection) {
  api.start = () => bridge.sendSidePanelCommand('picker.start');
  api.stop = () => bridge.sendSidePanelCommand('picker.stop');
  api.toggle = () => bridge.sendSidePanelCommand('picker.start');
  api.clear = selection.clearSelections;
  api.getSelected = () => ({
    element: null,
    selections: selection.selectionPayloads()
  });
}
