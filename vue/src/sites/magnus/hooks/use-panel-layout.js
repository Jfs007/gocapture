import { computed, ref } from 'vue';

const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 760;
const COLLAPSED_PANEL_WIDTH = 54;

export function usePanelLayout({ active }) {
  const collapsed = ref(false);
  const resizing = ref(false);
  const panelWidth = ref(440);
  let resizeState = null;
  let pageStyleSnapshot = null;
  let lastAppliedPanelWidth = 0;
  let resizeDispatchFrame = 0;

  const effectivePanelWidth = computed(() => collapsed.value ? COLLAPSED_PANEL_WIDTH : clampPanelWidth(panelWidth.value));
  const panelStyle = computed(() => ({
    width: `${effectivePanelWidth.value}px`,
    maxWidth: 'calc(100vw - 18px)'
  }));

  function clampPanelWidth(value) {
    const viewportWidth = window.innerWidth || MAX_PANEL_WIDTH;
    const viewportMax = Math.max(220, Math.min(MAX_PANEL_WIDTH, viewportWidth - 18));
    const minWidth = Math.min(MIN_PANEL_WIDTH, viewportMax);
    return Math.max(minWidth, Math.min(Math.round(Number(value) || 440), viewportMax));
  }

  function capturePageStyleSnapshot() {
    if (pageStyleSnapshot || !document.body) return;
    pageStyleSnapshot = {
      bodyWidth: document.body.style.width,
      bodyMaxWidth: document.body.style.maxWidth,
      bodyMinWidth: document.body.style.minWidth,
      bodyBoxSizing: document.body.style.boxSizing,
      bodyTransition: document.body.style.transition,
      bodyUserSelect: document.body.style.userSelect,
      htmlOverflowX: document.documentElement.style.overflowX
    };
  }

  function applyPageInset() {
    if (!document.body) return;
    capturePageStyleSnapshot();
    const currentWidth = effectivePanelWidth.value;
    const width = `calc(100% - ${effectivePanelWidth.value}px)`;
    document.body.style.boxSizing = 'border-box';
    document.body.style.width = width;
    document.body.style.maxWidth = width;
    document.body.style.minWidth = '0';
    document.body.style.transition = resizing.value ? 'none' : 'width 120ms ease, max-width 120ms ease';
    document.documentElement.style.overflowX = 'hidden';
    if (lastAppliedPanelWidth === currentWidth) return;
    lastAppliedPanelWidth = currentWidth;
    if (resizeDispatchFrame) cancelAnimationFrame(resizeDispatchFrame);
    resizeDispatchFrame = window.requestAnimationFrame(() => {
      resizeDispatchFrame = 0;
      window.dispatchEvent(new Event('resize'));
    });
  }

  function restorePageInset() {
    if (!pageStyleSnapshot || !document.body) return;
    document.body.style.width = pageStyleSnapshot.bodyWidth;
    document.body.style.maxWidth = pageStyleSnapshot.bodyMaxWidth;
    document.body.style.minWidth = pageStyleSnapshot.bodyMinWidth;
    document.body.style.boxSizing = pageStyleSnapshot.bodyBoxSizing;
    document.body.style.transition = pageStyleSnapshot.bodyTransition;
    document.body.style.userSelect = pageStyleSnapshot.bodyUserSelect;
    document.documentElement.style.overflowX = pageStyleSnapshot.htmlOverflowX;
    pageStyleSnapshot = null;
    lastAppliedPanelWidth = 0;
  }

  function startPanelResize(event) {
    if (collapsed.value) return;
    resizeState = {
      startX: event.clientX,
      startWidth: panelWidth.value
    };
    resizing.value = true;
    document.documentElement.style.cursor = 'col-resize';
    if (document.body) document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPanelResizeMove, true);
    window.addEventListener('pointerup', stopPanelResize, true);
    window.addEventListener('pointercancel', stopPanelResize, true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (error) {
    }
  }

  function onPanelResizeMove(event) {
    if (!resizeState) return;
    event.preventDefault();
    event.stopPropagation();
    const nextWidth = resizeState.startWidth + resizeState.startX - event.clientX;
    panelWidth.value = clampPanelWidth(nextWidth);
  }

  function stopPanelResize() {
    if (!resizeState) return;
    resizeState = null;
    resizing.value = false;
    window.removeEventListener('pointermove', onPanelResizeMove, true);
    window.removeEventListener('pointerup', stopPanelResize, true);
    window.removeEventListener('pointercancel', stopPanelResize, true);
    document.documentElement.style.cursor = active.value ? 'crosshair' : '';
    if (document.body && pageStyleSnapshot) document.body.style.userSelect = pageStyleSnapshot.bodyUserSelect;
  }

  function syncPanelWidth() {
    const clampedWidth = clampPanelWidth(panelWidth.value);
    if (panelWidth.value !== clampedWidth) panelWidth.value = clampedWidth;
  }

  function cleanupPanelLayout() {
    stopPanelResize();
    if (resizeDispatchFrame) cancelAnimationFrame(resizeDispatchFrame);
    resizeDispatchFrame = 0;
    restorePageInset();
  }

  return {
    collapsed,
    resizing,
    panelWidth,
    effectivePanelWidth,
    panelStyle,
    clampPanelWidth,
    applyPageInset,
    restorePageInset,
    startPanelResize,
    stopPanelResize,
    syncPanelWidth,
    cleanupPanelLayout
  };
}
