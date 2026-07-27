'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function resolveProjectFile(project, filePath) {
  if (!project || !project.path) throw new Error('No project selected.');
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) throw new Error('File path is required.');
  const fullPath = path.resolve(project.path, normalized);
  const projectRoot = path.resolve(project.path);
  if (fullPath !== projectRoot && !fullPath.startsWith(`${projectRoot}${path.sep}`)) {
    throw new Error('File path is outside current project.');
  }
  if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${normalized}`);
  return fullPath;
}

function openFileInEditor(fullPath, line = 0, column = 0) {
  const editor = process.env.GOCAPTURE_EDITOR || '';
  const target = Number(line) > 0
    ? `${fullPath}:${Math.max(1, Number(line))}:${Math.max(1, Number(column) || 1)}`
    : fullPath;
  let command;
  let args;
  if (editor) {
    const parts = editor.split(/\s+/).filter(Boolean);
    command = parts[0];
    args = [...parts.slice(1), target];
  } else if (process.platform === 'darwin') {
    command = 'code';
    args = Number(line) > 0 ? ['--goto', target] : ['-a', 'Visual Studio Code', fullPath];
  } else {
    command = 'code';
    args = Number(line) > 0 ? ['--goto', target] : [fullPath];
  }
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.on('error', () => {
    const fallbackCommand = process.platform === 'darwin' ? 'open' : 'xdg-open';
    const fallback = spawn(fallbackCommand, [fullPath], { detached: true, stdio: 'ignore' });
    fallback.on('error', () => {});
    fallback.unref();
  });
  child.unref();
}

module.exports = {
  openFileInEditor,
  resolveProjectFile,
};
