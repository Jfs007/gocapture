import { sourceServerJson } from '../../services/source-service';

export interface ProjectApi {
  openSourceFile(file: string): Promise<void>;
}

export function createProjectApi(): ProjectApi {
  return {
    async openSourceFile(file) {
      await sourceServerJson('/api/source/open', {
        method: 'POST',
        body: { file },
        timeoutMs: 5000,
        timeoutMessage: '打开源码文件超时，请确认本地源码服务可用'
      });
    }
  };
}
