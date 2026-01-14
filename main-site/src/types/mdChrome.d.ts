declare global {
  interface Window {
    _exports: {
      module: Record<string, any>;
    };
    _require: (name: string) => any;
    __WEB_REQUEST_API__: WebRequestAPI;
    __WEB_REQUEST_VERSION__: string;
  }

  function _require(name: 'mdChrome'): MdChromeModule;
  function _require(name: 'webHook'): WebRequestAPI;
  function _require(name: string): any;
}

export interface InjectScriptOptions {
  force?: boolean;
}

export interface MdChromeWeb {
  cmd<T = any>(params: any): Promise<T>;
  injectScript(scriptPath: string | string[]): Promise<void>;
  injectScript2(scriptPath: string | string[], options?: InjectScriptOptions): Promise<void>;
  invalidateScriptCache(scriptPath: string | string[]): void;
}

export interface MdChromeModule {
  web: MdChromeWeb;
}

export interface WebRequestResponse {
  url: string;
  result: any;
  request: {
    headers: Record<string, string>;
    body: any;
  };
  method: string;
  modified: boolean;
}

export interface WebRequestModified {
  url: string;
  method: string;
  originalBody: string;
  modifiedBody: string;
  type: 'fetch' | 'xhr';
}

export interface InterceptRule {
  urlPattern: string;
  modifier?: (bodyData: any) => any;
  modifications?: Array<{
    action: 'update' | 'add' | 'delete';
    path: string;
    value?: any;
  }>;
}

export interface WebRequestAPI {
  cache: Array<{
    type: 'WEB_REQUEST_RESPONSE';
    data: WebRequestResponse;
  }>;
  addCache(info: any): void;
  ready(): void;
  isReady(): boolean;
  onResponse(callback: (data: WebRequestResponse) => void): void;
  onRequestModify(callback: (data: WebRequestModified) => void): void;
  addRule(rule: InterceptRule): void;
  removeRule(urlPattern: string): void;
  getRules(): InterceptRule[];
  updateRule(urlPattern: string, modifications: InterceptRule['modifications']): void;
}

export interface MessageEvent {
  data: {
    type: 'WEB_REQUEST_RESPONSE' | 'WEB_REQUEST_MODIFIED';
    data: WebRequestResponse | WebRequestModified;
  };
}

export {};
