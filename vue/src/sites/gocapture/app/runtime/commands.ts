import { inject, provide } from 'vue';
import { PRODUCT_NAME } from '../config/product';

export interface GoCaptureCommands {
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

const GOCAPTURE_COMMANDS_KEY = Symbol('gocapture.commands');

export function provideGoCaptureCommands(commands: GoCaptureCommands) {
  provide(GOCAPTURE_COMMANDS_KEY, commands);
}

export function useGoCaptureCommands(): GoCaptureCommands {
  const commands = inject<GoCaptureCommands>(GOCAPTURE_COMMANDS_KEY);
  if (!commands) throw new Error(`${PRODUCT_NAME} commands are not provided`);
  return commands;
}
