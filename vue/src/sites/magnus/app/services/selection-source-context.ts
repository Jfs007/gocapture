import type { SelectionSourceBinding, SelectionSourceTarget } from '../types/selection.types';

interface BoundSelectionContext {
  uid: string;
  binding: SelectionSourceBinding;
}

export function sourceTargetsFromCandidates(candidates: any[]): SelectionSourceTarget[] {
  return (Array.isArray(candidates) ? candidates : [])
    .filter(hit => hit?.file)
    .map(hit => ({
      file: String(hit.file),
      role: String(hit.role || hit.sourceRole || 'related'),
      // unlocated：本地未能把选区定位到具体源码，绝不用漂移的粗片段（会误导 LLM 到别的列）——
      // 留空，让变更计划 LLM 依据原始选区身份 + 完整文件自己定位。
      codeSnippet: hit.scopeAlignment === 'unlocated'
        ? ''
        : String(
          hit.modelCodeSnippet
          || hit.preciseSnippet
          || hit.uniqueSnippet
          || hit.snippet
          || ''
        ),
      importChain: Array.isArray(hit.importChain) ? hit.importChain.map(String) : [],
      directionGuess: String(hit.modelDirectionGuess || ''),
      locateLevel: String(hit.modelLocateLevel || 'exact'),
      scopeAlignment: String(hit.scopeAlignment || hit.composite?.render?.scopeAlignment || ''),
      reasons: Array.isArray(hit.reasons) ? hit.reasons.map(String).slice(0, 8) : []
    }));
}

export function candidateHitsFromBindings(bindings: BoundSelectionContext[]) {
  const targets = dedupeBoundTargets(bindings.flatMap(item => {
    return item.binding.targets.map(target => ({
      ...target,
      designRequirement: item.binding.designRequirement
    }));
  }));
  return targets.map((target, index) => ({
    file: target.file,
    score: 1200 - index * 20,
    stage: 'selection-context',
    reasons: [
      '复用当前选区已确认的源码上下文',
      ...(target.reasons || [])
    ],
    snippet: target.codeSnippet || '',
    modelCodeSnippet: target.codeSnippet || '',
    modelDirectionGuess: target.directionGuess || '',
    role: target.role || 'related',
    modelLocateLevel: target.locateLevel || 'exact',
    scopeAlignment: target.scopeAlignment || '',
    modelSnippetVerified: true,
    importChain: target.importChain || [],
    selectionDesignRequirement: target.designRequirement || ''
  }));
}

function dedupeBoundTargets(targets: Array<SelectionSourceTarget & { designRequirement?: string }>) {
  const byFile = new Map<string, SelectionSourceTarget & { designRequirement?: string }>();
  for (const target of targets) {
    if (!target?.file) continue;
    const old = byFile.get(target.file);
    if (!old) {
      byFile.set(target.file, target);
      continue;
    }
    byFile.set(target.file, {
      ...old,
      codeSnippet: old.codeSnippet || target.codeSnippet || '',
      importChain: old.importChain?.length ? old.importChain : (target.importChain || []),
      directionGuess: old.directionGuess || target.directionGuess || '',
      reasons: Array.from(new Set([...(old.reasons || []), ...(target.reasons || [])]))
    });
  }
  return Array.from(byFile.values());
}
