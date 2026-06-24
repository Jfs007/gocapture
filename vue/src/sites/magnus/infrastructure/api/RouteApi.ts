import { sourceServerJson } from '../../services/source-service';
import type { RouteResolverTrace } from '../../domain/route/route.types';

export interface RouteApi {
  resolve(input: { url: string; pagePath: string }): Promise<RouteResolverTrace | null>;
}

export function createRouteApi(): RouteApi {
  return {
    async resolve(input) {
      const data = await sourceServerJson('/api/route/resolve', {
        method: 'POST',
        body: input,
        timeoutMs: 5000,
        timeoutMessage: '页面路由解析超过 5 秒'
      });
      return data.routeResolver || null;
    }
  };
}
