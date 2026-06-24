export function createSelectProjectUseCase(selectProject: () => Promise<void> | void) {
  return async function selectProject() {
    await selectProject();
  };
}
