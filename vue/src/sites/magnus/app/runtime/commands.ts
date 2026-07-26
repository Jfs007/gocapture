import { inject, provide } from 'vue';
import { PRODUCT_NAME } from '../config/product';

export interface MagnusCommands {
  sendRequest(): Promise<void>;
  resolveRoute(): Promise<void>;
  selectProject(): Promise<void>;
  openSourceFile(file: string, line?: number, column?: number): Promise<void>;
  openSettings(section?: string): void;
  rebindSidePanel(): void;
  copyPrompt(): void;
  copyText(text: string): void;
  previewSelection(asset: any): void;
  restoreSelectionPreview(): void;
  expandSelection(id: string): Promise<void>;
  removeSelection(id: string): Promise<void>;
  clearSelections(): Promise<void>;
  toggleCandidateFile(hit: any): void;
  toggleCandidateDetail(hit: any): void;
  setIncludeApiEvidence(value: boolean): void;
  onSearchOptionChange(): void;
  openModelEditor(model?: any): void;
  openProviderModelEditor(provider: string): void;
  closeModelEditor(): void;
  saveModelForm(): void;
  removeSelectedModel(): void;
  setSelectedModel(id: string): void;
  selectModelAndEnable(id: string): void;
  disableModelAssist(): void;
  setUseModelAssist(value: boolean): void;
  resetModelAssist(): void;
  stopModelAssist(): void;
}

const MAGNUS_COMMANDS_KEY = Symbol('magnus.commands');

export function provideMagnusCommands(commands: MagnusCommands) {
  provide(MAGNUS_COMMANDS_KEY, commands);
}

export function useMagnusCommands(): MagnusCommands {
  const commands = inject<MagnusCommands>(MAGNUS_COMMANDS_KEY);
  if (!commands) throw new Error(`${PRODUCT_NAME} commands are not provided`);
  return commands;
}
