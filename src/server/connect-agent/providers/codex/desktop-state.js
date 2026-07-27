'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function loadProjectlessThreadIds(options = {}) {
  const home = options.homeDir || os.homedir();
  const file = path.join(home, '.codex', '.codex-global-state.json');
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    const ids = state?.['projectless-thread-ids'];
    return new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean));
  } catch {
    return new Set();
  }
}

module.exports = {
  loadProjectlessThreadIds,
};
