const crypto = require('crypto');

function createId(prefix) {
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  return `${prefix}_${id.replace(/-/g, '').slice(0, 24)}`;
}

module.exports = {
  createId,
};
