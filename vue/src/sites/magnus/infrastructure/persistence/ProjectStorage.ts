import type { SourceProject } from '../../domain/project/source-project.types';

export interface ProjectStorage {
  read(key: string): SourceProject | null;
  write(key: string, project: SourceProject): void;
  remove(key: string): void;
}

export function createProjectStorage(storage: Storage = window.localStorage): ProjectStorage {
  return {
    read(key) {
      try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    },
    write(key, project) {
      storage.setItem(key, JSON.stringify(project));
    },
    remove(key) {
      storage.removeItem(key);
    }
  };
}
