import type { Ref } from 'vue';
import { hashRoutePath } from './route-resolver';

export function readCurrentHref(api: Record<string, any>) {
  if (api.sidePanelConfig?.snapshot?.page?.url) {
    return api.sidePanelConfig.snapshot.page.url;
  }
  try {
    return window.location.href || '';
  } catch (error) {
    return '';
  }
}

export function pageHostText(href: string) {
  try {
    return new URL(href).host || href;
  } catch (error) {
    return '-';
  }
}

export function pageUrlPath(href: string) {
  try {
    const url = new URL(href);
    return hashRoutePath(url.hash) || url.pathname || '/';
  } catch (error) {
    return '/';
  }
}

export function installLocationWatcher(currentPageHref: Ref<string>) {
  const rawPushState = window.history.pushState;
  const rawReplaceState = window.history.replaceState;
  const syncCurrentUrl = () => {
    const nextHref = readCurrentHref({ sidePanelConfig: window.__MAGNUS_SIDE_PANEL__ || {} });
    if (nextHref && nextHref !== currentPageHref.value) currentPageHref.value = nextHref;
  };
  const onChanged = () => window.setTimeout(syncCurrentUrl, 0);

  window.history.pushState = function pushState(...args) {
    const result = rawPushState.apply(this, args);
    onChanged();
    return result;
  };
  window.history.replaceState = function replaceState(...args) {
    const result = rawReplaceState.apply(this, args);
    onChanged();
    return result;
  };
  window.addEventListener('popstate', onChanged, true);
  window.addEventListener('hashchange', onChanged, true);

  return () => {
    window.history.pushState = rawPushState;
    window.history.replaceState = rawReplaceState;
    window.removeEventListener('popstate', onChanged, true);
    window.removeEventListener('hashchange', onChanged, true);
  };
}
