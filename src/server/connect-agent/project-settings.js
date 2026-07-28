'use strict';

const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = 'connect-agent.json';

function settingsPath(project) {
  return path.join(project.path, '.gocapture', SETTINGS_FILE);
}

function normalizeProjectAgentSettings(raw) {
  return {
    proxy: String(raw?.proxy || '').trim(),
    activeProviderId: String(raw?.activeProviderId || '').trim(),
  };
}

function validateProjectAgentSettings(settings) {
  if (!settings.proxy) return '';
  try {
    const url = new URL(settings.proxy);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return 'Agent 代理地址仅支持 HTTP 或 HTTPS';
    }
  } catch (error) {
    return '代理地址不是有效 URL';
  }
  return '';
}

function loadProjectAgentSettings(project) {
  try {
    return normalizeProjectAgentSettings(
      JSON.parse(fs.readFileSync(settingsPath(project), 'utf8')),
    );
  } catch (error) {
    return normalizeProjectAgentSettings({});
  }
}

function saveProjectAgentSettings(project, raw) {
  const settings = normalizeProjectAgentSettings({
    ...loadProjectAgentSettings(project),
    ...(raw || {}),
  });
  const validationError = validateProjectAgentSettings(settings);
  if (validationError) throw new Error(validationError);
  const file = settingsPath(project);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  return settings;
}

module.exports = {
  SETTINGS_FILE,
  loadProjectAgentSettings,
  normalizeProjectAgentSettings,
  saveProjectAgentSettings,
  settingsPath,
  validateProjectAgentSettings,
};
