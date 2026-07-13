const { normalizeConfidence, isRenderCandidate, dominantRenderCandidate } = require('./candidate-relations');

function normalizeJudge(parsed, project, allowedFiles = []) {
  const fileSet = new Set((project.files || []).map(file => file.path));
  const allowed = new Set(allowedFiles);
  const files = (Array.isArray(parsed?.files) ? parsed.files : [])
    .map(item => ({
      file: String(item?.file || '').replace(/^\/+/, ''),
      role: ['render', 'definition', 'assembly'].includes(item?.role) ? item.role : 'render',
      confidence: normalizeConfidence(item?.confidence),
      reason: String(item?.reason || ''),
    }))
    .filter(item => fileSet.has(item.file) && allowed.has(item.file));
  return {
    status: parsed?.status === 'unique' && files.length
      ? 'unique'
      : 'ambiguous',
    files,
  };
}

function agentHits(inspection, judge, ownership = []) {
  const candidateByFile = new Map((inspection.candidates || []).map(candidate => [candidate.file, candidate]));
  const renderCandidates = (inspection.candidates || []).filter(isRenderCandidate);
  const hasPrimaryCandidate = renderCandidates.length > 0;
  let selected;
  if (judge?.files?.length) {
    // Judge 可以把本地无法理解的 unknown 源码确认为自定义渲染器；
    // 但不能把已由客观文件事实确认的样式/数据定义(referenceOnly)冒充为 DOM 主渲染。
    selected = judge.files.filter(item => {
      const candidate = candidateByFile.get(item.file);
      if (!candidate || candidate.referenceOnly) return false;
      return item.role === 'render' || isRenderCandidate(candidate) || !hasPrimaryCandidate;
    });
  } else {
    selected = [];
  }
  // Judge 的唯一结论若与客观文件角色冲突，必须失败关闭。
  // 继续回退到全部候选会让上层把样式/数据文件误当成已确认源码。
  if (judge?.status === 'unique' && judge.files?.length && !selected.length) {
    return [];
  }
  // 无有效 Judge 结论时的兜底：从「渲染候选」里挑，而不是直接用可能是参考文件(如路由配置)的最高分 selectedFile。
  if (!selected.length) {
    const renderPick = dominantRenderCandidate(inspection)
      || renderCandidates.sort((a, b) => b.score - a.score)[0]
      || (inspection.status === 'unique'
        ? candidateByFile.get(inspection.selectedFile)
        : null);
    if (renderPick) {
      selected = [{ file: renderPick.file, role: 'render', confidence: 85, reason: '本地渲染候选事实收敛（排除定义/参考文件）' }];
    }
  }
  const uniqueDecision = judge?.status === 'unique';
  const selectedMap = new Map(selected.map(item => [item.file, item]));
  const baseCandidates = selected.length
    ? inspection.candidates.filter(candidate => selectedMap.has(candidate.file))
    : inspection.candidates;
  const ranked = baseCandidates.map(candidate => {
    const decision = selectedMap.get(candidate.file);
    return {
      file: candidate.file,
      score: decision && uniqueDecision ? 1800 + candidate.score : candidate.score,
      stage: 'dom-agent',
      preciseEvidence: !!decision && uniqueDecision,
      sourceRole: decision?.role || '',
      modelConfidence: decision?.confidence || 0,
      snippet: candidate.excerpt,
      preciseSnippet: decision && uniqueDecision ? candidate.excerpt : '',
      reasons: [
        'DOM Agent：LLM 检索计划 → 本地候选事实对照',
        ...(candidate.matchedGroups || []).map(group => `同组命中：${group.keywords.join(' + ')}`),
        candidate.commentOnly.length ? `纯注释命中：${candidate.commentOnly.join('、')}` : '',
        (candidate.structureMismatches || []).length
          ? `DOM/源码静态节点不一致：${candidate.structureMismatches.map(item => {
              const tagDiff = `${item.domTags.join('|')} != ${item.sourceTags.join('|')}`;
              const classDiff = `${(item.domClasses || []).join('|') || '-'} != ${(item.sourceClasses || []).join('|') || '-'}`;
              return `${item.keyword}(tag: ${tagDiff}; class: ${classDiff})`;
            }).join('、')}`
          : '',
        decision?.reason || '',
      ].filter(Boolean).slice(0, 12),
    };
  });
  const inspectedFiles = new Set(ranked.map(item => item.file));
  for (const decision of selected) {
    if (inspectedFiles.has(decision.file)) continue;
    const owner = ownership.find(item => item.file === decision.file);
    if (!owner) continue;
    ranked.push({
      file: decision.file,
      score: 1800 + Math.max(0, Number(decision.confidence || 0)),
      stage: 'dom-agent',
      preciseEvidence: true,
      sourceRole: decision.role || '',
      modelConfidence: decision.confidence || 0,
      snippet: owner.excerpt || '',
      preciseSnippet: owner.excerpt || '',
      importChain: owner.chain || [],
      reasons: [
        'DOM Agent：候选源码引用链',
        owner.chain?.length ? `引用链：${owner.chain.join(' -> ')}` : '',
        decision.reason || '',
      ].filter(Boolean),
    });
  }
  return ranked.sort((a, b) => b.score - a.score);
}

module.exports = {
  normalizeJudge,
  agentHits,
};
