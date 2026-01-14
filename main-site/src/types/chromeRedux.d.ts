declare global {
  function _require(name: 'chromeRedux'): ChromeReduxModule;
}

export interface ChromeReduxModule {
  registerModule(name: string, module: any): void;
  init(): void;
  get(moduleName: string): Promise<any>;
  set(moduleName: string, data: any): Promise<void>;
}

export interface UserInfo {
  token?: string;
  username?: string;
  userId?: string;
  [key: string]: any;
}

export {};
