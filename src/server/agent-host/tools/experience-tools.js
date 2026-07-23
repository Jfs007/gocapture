'use strict';

const {
  componentExperienceCatalog,
  loadComponentExperiences,
  saveComponentExperiences,
  validateComponentExperience,
} = require('../../experience/component-experience');
const { runDiscoveryOperation } = require('../../experience/discovery-executor');
const { loadStructureDoc } = require('../../experience/project-structure');
const { createToolProvider } = require('./provider');
const { buildTool } = require('./tool');

function experienceCatalog(project) {
  return componentExperienceCatalog(project).map(record => {
    const state = record.validation;
    return {
      path: record.componentPath,
      role: record.role || '',
      keywords: record.keywords || [],
      valid: state.valid,
      evidenceFiles: state.existingEvidenceFiles,
      updatedAt: record.updatedAt || '',
    };
  });
}

function loadExperiences(project, paths) {
  const requested = new Set((paths || []).map(String));
  return loadComponentExperiences(project)
    .filter(record => requested.has(record.componentPath))
    .map(record => {
      const state = validateComponentExperience(project, record);
      return {
        path: record.componentPath,
        role: record.role || '',
        keywords: record.keywords || [],
        valid: state.valid,
        evidenceFiles: state.existingEvidenceFiles,
        documentation: state.valid ? record.doc : '',
      };
    });
}

function reconSearch(project, input, textCache) {
  return runDiscoveryOperation(project, {
    operation: 'find_related_examples',
    terms: input.terms || [],
    scope: { roots: input.roots || [] },
    maxResults: Math.min(30, Math.max(1, Number(input.maxResults || 12))),
  }, textCache);
}

function recordExperience(project, input) {
  const files = new Set((project?.files || []).map(file => String(file.path || '')));
  const evidenceFiles = Array.from(new Set((input.evidenceFiles || []).map(String).filter(Boolean)));
  if (!input.capabilityPath || !String(input.documentation || '').trim()) {
    throw new Error('recon_record requires capabilityPath and documentation.');
  }
  if (!evidenceFiles.length || evidenceFiles.some(file => !files.has(file))) {
    throw new Error('recon_record requires existing project files as evidenceFiles.');
  }
  saveComponentExperiences(project, [{
    componentPath: String(input.capabilityPath),
    name: String(input.name || '').trim() || String(input.capabilityPath).split('/').filter(Boolean).pop(),
    role: String(input.role || ''),
    keywords: (input.keywords || []).map(String).filter(Boolean),
    usagePath: evidenceFiles[0],
    usageFiles: evidenceFiles,
    doc: String(input.documentation),
    files: evidenceFiles.length,
  }]);
  return {
    recorded: true,
    capabilityPath: String(input.capabilityPath),
    evidenceFiles,
  };
}

const EXPERIENCE_TOOLS = [
  buildTool({
    name: 'recon_inspect',
    title: 'Inspect Reusable Project Capabilities',
    description: 'Read the project reuse-oriented Structure.md and the verified Experience catalog. Use only when the current change may need an existing project convention or reusable capability. This returns leads, not implementation conclusions.',
    category: 'experience',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: { focus: { type: 'string' } },
      required: ['focus'],
    },
    call: ({ project, input }) => {
      const catalog = experienceCatalog(project);
      return {
        focus: String(input.focus || ''),
        structure: loadStructureDoc(project),
        experiences: loadExperiences(project, catalog.filter(item => item.valid).map(item => item.path)),
      };
    },
  }),
  buildTool({
    name: 'experience_load',
    title: 'Load Verified Experiences',
    description: 'Load selected project Experience documents after revalidating that their evidence files still exist. Choose paths from recon_inspect; invalid records return no documentation.',
    category: 'experience',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: { paths: { type: 'array', items: { type: 'string' } } },
      required: ['paths'],
    },
    call: ({ project, input }) => ({ experiences: loadExperiences(project, input.paths) }),
  }),
  buildTool({
    name: 'recon_search',
    title: 'Search Project Reuse Examples',
    description: 'Search for real project usage examples using model-selected literal terms and optional roots. Returns source evidence only; the Planning Agent decides whether examples are relevant.',
    category: 'experience',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        terms: { type: 'array', items: { type: 'string' } },
        roots: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
      },
      required: ['terms'],
    },
    call: ({ project, input, textCache }) => reconSearch(project, input, textCache),
  }),
  buildTool({
    name: 'recon_record',
    title: 'Record Verified Project Experience',
    description: 'Record a reusable implementation pattern only after real project evidence has been read and understood. Every evidenceFiles entry must currently exist in the project.',
    category: 'experience',
    access: 'write',
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    inputSchema: {
      type: 'object',
      properties: {
        capabilityPath: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string' },
        keywords: { type: 'array', items: { type: 'string' } },
        evidenceFiles: { type: 'array', items: { type: 'string' } },
        documentation: { type: 'string' },
      },
      required: ['capabilityPath', 'evidenceFiles', 'documentation'],
    },
    call: ({ project, input }) => recordExperience(project, input),
  }),
];

const experienceToolProvider = createToolProvider({
  id: 'builtin.experience',
  title: 'Recon and Experience Tools',
  source: 'builtin',
  description: 'Model-invoked tools for inspecting project reuse structure, finding examples, loading verified Experience, and recording evidence-backed patterns.',
  tools: EXPERIENCE_TOOLS,
});

module.exports = {
  experienceCatalog,
  experienceToolProvider,
  loadExperiences,
  reconSearch,
  recordExperience,
};
