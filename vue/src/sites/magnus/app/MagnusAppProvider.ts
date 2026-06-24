import { inject, provide } from 'vue';

export interface MagnusCommands {
  sendRequest(): Promise<void>;
  resolveRoute(): Promise<void>;
  selectProject(): Promise<void>;
  openSourceFile(file: string): Promise<void>;
  copyPrompt(): void;
  expandSelection(id: string): Promise<void>;
  removeSelection(id: string): Promise<void>;
  clearSelections(): Promise<void>;
}

const MAGNUS_COMMANDS_KEY = Symbol('magnus.commands');

export function provideMagnusCommands(commands: MagnusCommands) {
  provide(MAGNUS_COMMANDS_KEY, commands);
}

export function useMagnusCommands(): MagnusCommands {
  const commands = inject<MagnusCommands>(MAGNUS_COMMANDS_KEY);
  if (!commands) throw new Error('Magnus commands are not provided');
  return commands;
}
