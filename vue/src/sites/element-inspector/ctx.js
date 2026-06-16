import { inject, provide, shallowRef } from 'vue';

export const CTX_VALUE_KEY = Symbol('magnus-inspector-ctx-value');
export const CTX_API_KEY = Symbol('magnus-inspector-ctx-api');

export function useCtx(ctxValue, ctxApi) {
  const value = shallowRef(ctxValue || {});
  const api = ctxApi || {};

  const setup = () => {
    provide(CTX_VALUE_KEY, value);
    provide(CTX_API_KEY, api);
  };

  return {
    value,
    ...api,
    setup
  };
}

export function useForm(key) {
  const ctxValue = inject(CTX_VALUE_KEY);
  if (!ctxValue) throw new Error('Magnus inspector context value is not provided');
  if (!key) return ctxValue;
  return ctxValue.value[key];
}

export function useApi() {
  const api = inject(CTX_API_KEY);
  if (!api) throw new Error('Magnus inspector context api is not provided');
  return api;
}

export function useParams() {
  const api = useApi();
  return {
    params: () => api.buildParams()
  };
}
