import { sourceServerJson } from './source-service';

export interface ProjectSelectionReference {
  selectionId: string;
  thumbnail?: string;
  locations: Array<{
    file: string;
    startLine: number;
    endLine: number;
    anchor: string;
  }>;
}

export async function loadProjectSelectionReferences(projectRoot: string) {
  if (!projectRoot) return [] as ProjectSelectionReference[];
  const data = await sourceServerJson(
    `/api/connect-agents/selections?projectRoot=${encodeURIComponent(projectRoot)}`
  );
  return Array.isArray(data?.selections)
    ? data.selections as ProjectSelectionReference[]
    : [];
}

export async function deleteProjectSelectionReferences(
  projectRoot: string,
  selectionIds: string[] = []
) {
  if (!projectRoot) return;
  await sourceServerJson('/api/connect-agents/selections', {
    method: 'DELETE',
    body: { projectRoot, selectionIds }
  });
}
