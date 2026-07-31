import { useAppUiStore } from '../../stores/app-ui.store';
import { useConnectAgentStore } from '../../stores/connect-agent.store';
import {
  respondConnectAgentTool,
  runConnectAgentTask
} from '../services/connect-agent.service';
import type { GoCaptureRuntimeState } from '../runtime/context';
import { PRODUCT_NAME } from '../config/product';

export function createComposerWorkflow(state: GoCaptureRuntimeState) {
  const { source, route, search, selection, composer, prompt } = state;
  const appUiStore = useAppUiStore();
  const connectAgentStore = useConnectAgentStore();

  // 原始选区 DOM 身份的快照（扩区前抓取，全程保留）。用于把「用户到底选了什么」传给变更计划 LLM——
  // 否则扩区后 selectedItems 变成整行、¥3 这类无锚点选区身份就彻底丢了，LLM 只能在区域里瞎猜。
  let lastOriginSelections: any[] = [];
  const activeAgentToolCalls = new Set<string>();
  // 从祖先链提取「稳定容器标识」，说明选区落在哪（如所在列 data-col-key=cost → 源码列配置 key:'cost'）。
  // 通用机制：任何祖先上形如业务标识符的 data-*/id/name 值都算，排除运行时/框架内部值。
  function ancestorContainerAnchors(el: any): string[] {
    const out: string[] = [];
    for (const ancestor of (Array.isArray(el?.ancestors) ? el.ancestors.slice(0, 5) : [])) {
      for (const [key, rawValue] of Object.entries(ancestor?.attrs || {})) {
        const k = String(key || '').toLowerCase();
        if ((!/^data-/.test(k) && k !== 'id' && k !== 'name') || /^data-v-/.test(k)) continue;
        const value = String(rawValue || '').trim();
        if (/^[A-Za-z][\w-]{1,39}$/.test(value) && !/^__.*__$/.test(value) && !/^\d+$/.test(value)) {
          out.push(`${key}=${value}`);
        }
      }
      for (const cls of String(ancestor?.className || '').split(/\s+/)) {
        const t = cls.trim();
        if (t && !/^(n-|el-|ivu-|ant-|van-|flex|grid|is-|has-|mt-|mb-|ml-|mr-|w-|h-|p-|m-)/.test(t)) out.push(t);
      }
    }
    return Array.from(new Set(out)).slice(0, 6);
  }
  function captureOriginSelections(instruction: string): any[] {
    try {
      const assets = prompt.referencedPromptAssets?.(instruction) || [];
      const items = selection.selectedItems?.value || [];
      const itemsById = new Map(items.map((item: any) => [item.uid, item]));
      return assets.map((asset: any) => ({
        token: asset.token,
        tag: asset.tag,
        text: asset.text,
        className: asset.className,
        attrs: asset.attrs,
        ancestors: asset.ancestors,
        container: ancestorContainerAnchors(itemsById.get(asset.uid)?.element),
        summary: asset.summary
      }));
    } catch {
      return [];
    }
  }

  async function sendComposer() {
    if (connectAgentStore.taskAwaitingInput) {
      const answer = composer.promptIntent.value.trim();
      if (!answer) return;
      if (await connectAgentStore.answerInteraction(answer)) {
        composer.resetPromptComposer();
      }
      return;
    }
    if (connectAgentStore.taskRunning) {
      connectAgentStore.cancelTask();
      return;
    }
    if (!source.project.value) return;
    const instruction = composer.promptIntent.value.trim();
    if (!instruction) return;
    if (!connectAgentStore.activeProvider?.connected) {
      appUiStore.setToast('请先关联开发 Agent');
      return;
    }
    if (!selection.referencedSelectionIds(instruction).length) {
      connectAgentStore.resetTask();
      await runConnectedAgent(instruction, [], { freeChat: true });
      return;
    }
    if (!selection.confirmSelectionContext(composer.invalidatePrompt)) return;
    await runConnectedAgentFromLocalEvidence(instruction);
  }

  async function runConnectedAgentFromLocalEvidence(instruction: string) {
    lastOriginSelections = captureOriginSelections(instruction);
    search.clearCandidateState?.();
    search.processLogs.value = [
      `${PRODUCT_NAME} 前置定位：整理路由事实、压缩 DOM 和已捕获页面事实`,
      '完成后交给关联 Agent 自行定位并开发（Evidence Gate：证据不足时扩区）'
    ];
    search.searchStartedAt.value = Date.now();
    search.searchFinishedAt.value = 0;
    connectAgentStore.resetTask();
    await runConnectedAgent(instruction, [], {
      searchPayload: prompt.searchPayload()
    });
    search.searchFinishedAt.value = Date.now();
  }

  // 直接从「当前选区 DOM」提取原始选区的稳定锚点——不依赖 Planner 是否成计划。
  // 因为像 ¥3/查看/cost 这种，Planner 常判为 need-more-context（无计划），若从计划取就永远丢了。
  // 用途：① 扩区收敛后回到用户最初选的那处做细定位；② 校验最终文件是否真的与原始选区有渲染/引用关系。
  // DOM Agent 定位收敛后启动唯一的 LangChain Planning Agent；Recon/Experience/Skills/MCP 均由 Agent 按需选用。
  function selectionSnapshotById(uid: string) {
    const items = selection.selectedItems?.value || [];
    return latestSelectionSnapshotFromItems(items.filter((item: any) => item.uid === uid));
  }

  async function waitForSelectionSnapshotChange(before: { uid: string; signature: string }) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 1500) {
      await sleep(80);
      const current = selectionSnapshotById(before.uid);
      if (current.uid && current.uid === before.uid && current.signature && current.signature !== before.signature) {
        return true;
      }
    }
    return false;
  }

  function projectRoot() {
    return String(source.project.value?.path || source.project.value?.root || '').trim();
  }

  async function runConnectedAgent(
    userInstruction: string,
    bindings: any[],
    options: {
      searchPayload?: Record<string, unknown>;
      freeChat?: boolean;
    } = {}
  ) {
    const provider = connectAgentStore.activeProvider;
    if (!provider?.connected) return false;
    const controller = new AbortController();
    connectAgentStore.beginTask(controller);
    selection.filesConfirmed.value = bindings.length > 0;
    search.appendProcessLog(options.freeChat
      ? `Connect Agent 分流：无选区，自由对话交给 ${provider.name}`
      : bindings.length
        ? `Connect Agent 分流：DOM Locator 已完成，交给 ${provider.name}`
        : `Connect Agent 分流：本地事实准备完成后，由 ${provider.name} 自行定位并开发`);
    try {
      const result = await runConnectAgentTask(provider.id, {
        projectRoot: projectRoot(),
        pageUrl: state.currentPageHref.value,
        userInstruction,
        selectionBindings: bindings,
        selectionThumbnails: selection.selectionThumbnails(userInstruction),
        searchPayload: options.searchPayload || null,
        conversationMode: options.freeChat ? 'chat' : 'selection'
      }, {
        controller,
        onEvent: event => {
          connectAgentStore.applyTaskEvent(event);
          const eventType = String(event?.rawType || event?.type || '');
          const capability = event?.capability
            || event?.timelineMessage?.metadata?.capability
            || null;
          if (eventType === 'agent-tool-required' && capability?.callId) {
            void fulfillAgentTool(provider.id, capability);
          }
          if (event?.type === 'locator-evidence' && event.evidence?.route) {
            route.applyRouteResolverTrace({
              pagePath: event.evidence.route.pagePath,
              matched: event.evidence.route.matched,
              bestPageFile: event.evidence.route.bestPageFile,
              hits: event.evidence.route.hits
            });
          }
        }
      });
      connectAgentStore.completeTask(result);
      selection.bindAgentLocations({
        references: result.selectionLocations || [],
        projectRoot: projectRoot(),
        designRequirement: userInstruction
      });
      appUiStore.setToast(`${provider.name} 已完成开发任务`);
    } catch (error) {
      connectAgentStore.failTask(error);
      appUiStore.setToast((error as Error)?.message || `${provider.name} 开发任务失败`);
    }
    return true;
  }

  async function fulfillAgentTool(providerId: string, capability: any) {
    const callId = String(capability?.callId || '').trim();
    const selectionId = String(capability?.input?.selectionId || '').trim();
    if (!callId || !selectionId || activeAgentToolCalls.has(callId)) return;
    activeAgentToolCalls.add(callId);
    let result: Record<string, unknown>;
    try {
      const before = selectionSnapshotById(selectionId);
      if (!before.uid) throw new Error('Agent 请求的选区不在本轮页面资产中');
      const beforePayload: any = prompt.searchPayload({ expandedRetry: true });
      const originalSelection = selectionFromPayload(beforePayload, selectionId);
      const targetSelection = originalSelection?.originalElement
        ? {
            ...originalSelection,
            element: originalSelection.originalElement
          }
        : originalSelection;
      search.appendProcessLog?.(
        `Agent Tool：扩大选区 ${selectionId}；原因：${capability?.input?.reason || '当前证据不足'}`
      );
      await selection.expandSelection(selectionId);
      const changed = await waitForSelectionSnapshotChange(before);
      const payload: any = prompt.searchPayload({ expandedRetry: true });
      const expandedSelection = selectionFromPayload(payload, selectionId);
      const marked = markOriginalSelection(expandedSelection, targetSelection, selectionId);
      const targetElement: any = targetSelection?.element || {};
      // 只回传定位需要的精简事实：目标身份 + 带标记的扩区 markup。
      // 绝不回传整个选区对象（ancestors / subtree / computedStyle 等元数据会膨胀到数百 KB，
      // 撞破 Agent 工具结果上限被转存文件，逼模型反复读文件浪费大量轮次）。
      result = {
        success: changed,
        selectionId,
        pageUrl: String(payload?.pageUrl || state.currentPageHref.value || ''),
        pagePath: String(payload?.pagePath || ''),
        target: {
          tag: String(targetElement.tag || targetElement.tagName || ''),
          selector: String(targetElement.selector || ''),
          text: String(targetElement.text || '')
        },
        markerEmbedded: marked.markerEmbedded,
        expandedMarkup: marked.markup,
        note: [
          '修改目标只有 target：即被 <gocapture-original-selection> 包裹的那个节点。',
          'expandedMarkup 的其余部分仅是用于定位的周围上下文，不要当作选区，也不要据此扩大改动范围。'
        ].join(''),
        message: changed
          ? 'The browser context was expanded while the original modification target was preserved.'
          : 'The browser selection could not be expanded further.'
      };
      search.appendProcessLog?.(
        changed
          ? `Agent Tool：选区 ${selectionId} 扩区完成，事实已返回 Agent`
          : `Agent Tool：选区 ${selectionId} 已无法继续扩区`
      );
    } catch (error) {
      result = {
        success: false,
        selectionId,
        error: (error as Error)?.message || String(error)
      };
    }
    try {
      await respondConnectAgentTool(
        providerId,
        projectRoot(),
        capability.taskId,
        callId,
        result
      );
    } catch (error) {
      search.appendProcessLog?.(
        `Agent Tool 返回失败：${(error as Error)?.message || String(error)}`
      );
    } finally {
      activeAgentToolCalls.delete(callId);
    }
  }

  function selectionFromPayload(payload: any, selectionId: string) {
    return (Array.isArray(payload?.selections) ? payload.selections : [])
      .find((item: any) => String(item?.uid || item?.selectionId || '') === selectionId)
      || null;
  }

  // 在「扩区后的 markup」里，把「原始选区那段 markup」用元素标签包起来标记出来。
  // 用元素（而非 HTML 注释）：服务端会用 compressDomMarkup 压缩/去重，注释会被解析器丢弃，元素能存活。
  // 返回精简字符串，不带任何选区元数据。
  function markOriginalSelection(expanded: any, target: any, selectionId: string) {
    const expandedElement = expanded?.element || {};
    const targetElement = target?.element || {};
    const expandedMarkup = String(expandedElement.rawOuterHtml || expandedElement.outerHtml || '');
    const targetMarkup = String(targetElement.rawOuterHtml || targetElement.outerHtml || '');
    if (!expandedMarkup) return { markerEmbedded: false, markup: targetMarkup };
    if (!targetMarkup || !expandedMarkup.includes(targetMarkup)) {
      return { markerEmbedded: false, markup: expandedMarkup };
    }
    return {
      markerEmbedded: true,
      markup: expandedMarkup.replace(
        targetMarkup,
        `<gocapture-original-selection data-selection-id="${selectionId}">${targetMarkup}</gocapture-original-selection>`
      )
    };
  }

  return {
    sendComposer
  };
}

// 从一次检索结果里取「原始选区的稳定锚点」候选（用于扩区全程保持的 focusAnchors）。
function latestSelectionSnapshotFromItems(items: any[]) {
  const latest = items[items.length - 1];
  if (!latest?.uid) return { uid: '', signature: '' };
  const info = latest.info || latest.element || {};
  const asset = latest.assetInfo || latest.asset || {};
  return {
    uid: latest.uid,
    signature: JSON.stringify([
      info.tag || info.tagName || '',
      info.selector || '',
      info.className || '',
      info.text || '',
      info.searchText || '',
      info.outerHtml || info.rawOuterHtml || '',
      asset.selector || '',
      asset.className || '',
      asset.text || '',
      asset.outerHtml || asset.rawOuterHtml || ''
    ]).slice(0, 20000)
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
