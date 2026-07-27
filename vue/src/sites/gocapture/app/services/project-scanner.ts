export const MAX_PROJECT_FILES = 800;
export const MAX_SNIPPET_BYTES = 180000;

export const PROJECT_SNIPPET_FILES = [
  'package.json',
  'vite.config.js',
  'vite.config.ts',
  'vue.config.js',
  'webpack.config.js',
  'src/main.js',
  'src/main.ts',
  'src/App.vue',
  'index.html'
];

const SKIP_DIRS = new Set([
  '.git',
  '.idea',
  '.vscode',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
  '.cache'
]);

export function normalizePath(path: string) {
  return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

export function shouldSkipPath(path: string) {
  const parts = normalizePath(path).split('/');
  return parts.some(part => SKIP_DIRS.has(part));
}

export function inferStack(files: Array<{ path: string }>, snippets: Record<string, string>) {
  const paths = files.map(file => file.path);
  const packageText = snippets['package.json'] || '';
  const hits: string[] = [];
  const hasPath = (matcher: (path: string) => boolean) => paths.some(matcher);
  const hasPackage = (text: string) => packageText.includes(text);

  if (hasPackage('"vue"') || hasPath(path => path.endsWith('.vue'))) hits.push('Vue');
  if (hasPackage('"react"') || hasPath(path => path.endsWith('.jsx') || path.endsWith('.tsx'))) hits.push('React');
  if (hasPackage('"vite"') || hasPath(path => path.startsWith('vite.config.'))) hits.push('Vite');
  if (hasPackage('"webpack"') || hasPath(path => path.includes('webpack.config'))) hits.push('Webpack');
  if (hasPackage('"typescript"') || hasPath(path => path.endsWith('.ts') || path.endsWith('.tsx'))) hits.push('TypeScript');
  if (hasPackage('"tailwindcss"') || hasPath(path => path.includes('tailwind.config'))) hits.push('Tailwind');
  return Array.from(new Set(hits));
}

async function readSnippetFromFile(file: any) {
  if (!file || !PROJECT_SNIPPET_FILES.includes(file.path)) return null;
  if (file.size > MAX_SNIPPET_BYTES) return null;
  try {
    const text = await file.raw.text();
    return [file.path, text.slice(0, 3000)];
  } catch (error) {
    return null;
  }
}

export async function buildProjectFromFileList(fileList: FileList | File[]) {
  const rawFiles = Array.from(fileList || []) as any[];
  const firstPath = normalizePath(rawFiles[0]?.webkitRelativePath || rawFiles[0]?.name || '');
  const rootName = firstPath.includes('/') ? firstPath.split('/')[0] : '本地项目';
  const files: any[] = [];
  for (const file of rawFiles) {
    const fullPath = normalizePath(file.webkitRelativePath || file.name);
    const path = fullPath.startsWith(`${rootName}/`) ? fullPath.slice(rootName.length + 1) : fullPath;
    if (!path || shouldSkipPath(path)) continue;
    files.push({
      path,
      name: file.name,
      size: file.size,
      raw: file
    });
    if (files.length >= MAX_PROJECT_FILES) break;
  }

  const snippets: Record<string, string> = {};
  const pairs = await Promise.all(files.map(readSnippetFromFile));
  pairs.filter(Boolean).forEach(pair => {
    if (!pair) return;
    const [path, text] = pair;
    snippets[path] = text;
  });

  const stack = inferStack(files, snippets);
  return {
    name: rootName,
    source: 'file-input',
    fileCount: files.length,
    files: files.map(({ raw, ...file }) => file),
    snippets,
    stack,
    stackText: stack.join(' / '),
    limited: rawFiles.length > files.length
  };
}

export async function scanDirectoryHandle(handle: any) {
  const files: any[] = [];
  const snippets: Record<string, string> = {};

  async function walk(dirHandle: any, prefix: string) {
    if (files.length >= MAX_PROJECT_FILES) return;
    for await (const [name, child] of dirHandle.entries()) {
      if (files.length >= MAX_PROJECT_FILES) break;
      const path = normalizePath(prefix ? `${prefix}/${name}` : name);
      if (shouldSkipPath(path)) continue;
      if (child.kind === 'directory') {
        await walk(child, path);
        continue;
      }
      if (child.kind !== 'file') continue;
      try {
        const file = await child.getFile();
        const item = {
          path,
          name,
          size: file.size,
          lastModified: file.lastModified
        };
        files.push(item);
        if (PROJECT_SNIPPET_FILES.includes(path) && file.size <= MAX_SNIPPET_BYTES) {
          snippets[path] = (await file.text()).slice(0, 3000);
        }
      } catch (error) {
      }
    }
  }

  await walk(handle, '');
  const stack = inferStack(files, snippets);
  return {
    name: handle.name || '本地项目',
    source: 'directory-picker',
    fileCount: files.length,
    files,
    snippets,
    stack,
    stackText: stack.join(' / '),
    limited: files.length >= MAX_PROJECT_FILES
  };
}
