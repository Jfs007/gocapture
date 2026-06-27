import type { Ref } from 'vue';

export function hashRoutePath(hash: string) {
  const value = String(hash || '').replace(/^#/, '');
  if (!value) return '';
  const route = value.startsWith('!/') ? value.slice(1) : value;
  if (!route.startsWith('/')) return '';
  return route.split('?')[0] || '/';
}

export function readCurrentHref(api: Record<string, any>) {
  if (api.sidePanelConfig?.snapshot?.page?.url) {
    return api.sidePanelConfig.snapshot.page.url;
  }
  if (api.sidePanelConfig?.panelTicket) {
    return '';
  }
  try {
    return window.location.href || '';
  } catch (error) {
    return '';
  }
}

export function isMagnusUiHref(href: string) {
  try {
    const url = new URL(href);
    return url.pathname === '/ui' || url.pathname === '/ui/';
  } catch (error) {
    return false;
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
    if (!nextHref || isMagnusUiHref(nextHref)) return;
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
