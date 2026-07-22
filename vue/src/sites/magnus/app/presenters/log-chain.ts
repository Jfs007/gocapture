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
  const body = textAfterColon(firstLine(value));
  const match = body.match(/^([^\s({]+)/);
  return match?.[1] || fallback;
}

function modelRound(value: string) {
  const match = value.match(ROUND_PATTERN);
  return match ? Number(match[1]) : null;
}

function classify(raw: string): Omit<LogChainNode, 'id' | 'raw' | 'expandable' | 'round'> {
  const head = firstLine(raw);

  if (/失败|报错|异常|\berror\b/i.test(head)) {
    return { kind: 'error', actor: '错误', title: head || '执行失败' };
  }
  if (/最终裁决|最终输出|最终结果|源码上下文已绑定|选区源码上下文已绑定/.test(head)) {
    return { kind: 'decision', actor: '结果', title: head.split('：')[0] || '最终结果' };
  }
  if (/工具调用：|^本地调用：/.test(head)) {
    return { kind: 'tool-call', actor: '本地工具', title: `调用 ${toolTitle(head, '工具')}` };
  }
  if (/工具结果：|^本地输出：/.test(head)) {
    return { kind: 'tool-result', actor: '本地工具', title: `${toolTitle(head, '工具')} 返回` };
  }
  if (/模型输入|模型输入上下文|API 模型请求|Agent 输入（|模型阶段：/.test(head)) {
    const round = modelRound(head);
    return { kind: 'llm-input', actor: 'LLM', title: round ? `第 ${round} 轮输入` : '模型输入' };
  }
  if (/模型输出|API 模型响应|模型返回|Agent 输出（/.test(head)) {
    const round = modelRound(head);
    return { kind: 'llm-output', actor: 'LLM', title: round ? `第 ${round} 轮输出` : '模型输出' };
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
