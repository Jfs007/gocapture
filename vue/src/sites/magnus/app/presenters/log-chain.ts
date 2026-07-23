export type LogNodeKind = 'process' | 'llm-input' | 'llm-output' | 'tool-call' | 'tool-result' | 'decision' | 'error';

export interface LogChainNode {
  id: string;
  kind: LogNodeKind;
  actor: '流程' | 'LLM' | '本地工具' | '结果' | '错误';
  title: string;
  raw: string;
  expandable: boolean;
  round: number | null;
}

const ROUND_PATTERN = /第\s*(\d+)\s*轮/;

function firstLine(value: string) {
  return value.split('\n', 1)[0].trim();
}

function textAfterColon(value: string) {
  const index = value.indexOf('：');
  return index >= 0 ? value.slice(index + 1).trim() : value.trim();
}

function toolTitle(value: string, fallback: string) {
  const explicit = value.match(/(?:工具调用：|工具结果：|本地调用：|本地输出：|Agent Tool [→✓✗])\s*([^\s({]+)/);
  if (explicit?.[1]) return explicit[1];
  const body = textAfterColon(firstLine(value));
  const match = body.match(/^([^\s({]+)/);
  return match?.[1] || fallback;
}

function parseToolInput(value: string) {
  const start = value.indexOf('{');
  if (start < 0) return null;
  try {
    return JSON.parse(value.slice(start));
  } catch {
    return null;
  }
}

function compactList(value: unknown, limit = 2) {
  if (!Array.isArray(value)) return '';
  const items = value.map(item => typeof item === 'object' && item
    ? String((item as any).text || (item as any).file || (item as any).path || '')
    : String(item || '')).filter(Boolean);
  if (!items.length) return '';
  return `${items.slice(0, limit).join('、')}${items.length > limit ? ` 等 ${items.length} 项` : ''}`;
}

function toolCallTitle(raw: string) {
  const name = toolTitle(raw, '工具');
  const input = parseToolInput(raw);
  if (!input) return `调用 ${name}`;
  const target = compactList(input.files)
    || String(input.file || input.path || input.target || '')
    || compactList(input.roots);
  const focus = String(input.around || '') || compactList(input.terms) || compactList(input.symbols) || compactList(input.anchors);
  const details = [target, focus].filter(Boolean);
  return `调用 ${name}${details.length ? ` · ${details.join(' · ')}` : ''}`;
}

function modelRound(value: string) {
  const match = value.match(ROUND_PATTERN);
  return match ? Number(match[1]) : null;
}

function modelSummary(head: string, label: string) {
  const details = textAfterColon(head);
  return details && details !== head ? `${label} · ${details.replace(/；/g, ' · ')}` : label;
}

function classify(raw: string): Omit<LogChainNode, 'id' | 'raw' | 'expandable' | 'round'> {
  const head = firstLine(raw);

  if (/失败|报错|异常|\berror\b/i.test(head)) {
    return { kind: 'error', actor: '错误', title: head || '执行失败' };
  }
  if (/最终裁决|最终输出|最终结果|源码上下文已绑定|选区源码上下文已绑定/.test(head)) {
    return { kind: 'decision', actor: '结果', title: head.split('：')[0] || '最终结果' };
  }
  if (/工具调用：|^本地调用：|Agent Tool →/.test(head)) {
    return { kind: 'tool-call', actor: '本地工具', title: toolCallTitle(raw) };
  }
  if (/工具结果：|^本地输出：|Agent Tool ✓/.test(head)) {
    return { kind: 'tool-result', actor: '本地工具', title: `${toolTitle(head, '工具')} 返回` };
  }
  if (/Agent Tool ✗/.test(head)) {
    return { kind: 'error', actor: '错误', title: head };
  }
  if (/模型输入|模型输入上下文|API 模型请求|Agent 输入（|模型阶段：/.test(head)) {
    const round = modelRound(head);
    const context = /输入上下文/.test(head);
    const label = round ? `第 ${round} 轮${context ? '输入上下文' : '输入'}` : context ? '模型输入上下文' : '模型输入';
    return { kind: 'llm-input', actor: 'LLM', title: context ? label : modelSummary(head, label) };
  }
  if (/LangChain 模型响应/.test(head)) {
    const round = modelRound(head);
    return { kind: 'llm-output', actor: 'LLM', title: modelSummary(head, round ? `第 ${round} 轮模型耗时` : '模型耗时') };
  }
  if (/模型输出|API 模型响应|模型返回|Agent 输出（/.test(head)) {
    const round = modelRound(head);
    const body = /输出正文/.test(head);
    const label = round ? `第 ${round} 轮${body ? '输出正文' : '输出'}` : body ? '模型输出正文' : '模型输出';
    return { kind: 'llm-output', actor: 'LLM', title: body ? label : modelSummary(head, label) };
  }

  return { kind: 'process', actor: '流程', title: head || '流程记录' };
}

export function buildLogChain(logs: unknown[]): LogChainNode[] {
  return (Array.isArray(logs) ? logs : [])
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .map((raw, index) => {
      const classified = classify(raw);
      return {
        ...classified,
        id: `log-${index}`,
        raw,
        expandable: raw.includes('\n') || raw.length > 180,
        round: modelRound(raw)
      };
    });
}

export function serializeLogs(logs: unknown[]) {
  return (Array.isArray(logs) ? logs : [])
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .join('\n\n');
}
