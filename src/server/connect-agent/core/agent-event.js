'use strict';

function normalizeAgentEvent(agent, event = {}) {
  const rawType = String(event?.type || '').trim();
  return {
    ...event,
    type: 'agent-event',
    agentId: agent?.id || agent?.manifest?.id || '',
    phase: eventPhase(rawType, event),
    rawType,
    message: String(event?.message || ''),
    task: event?.task || null,
    event: event?.event || null,
    fileDiffs: Array.isArray(event?.fileDiffs)
      ? event.fileDiffs
      : Array.isArray(event?.task?.fileDiffs)
        ? event.task.fileDiffs
        : [],
  };
}

function eventPhase(type, event) {
  if (/failed|error/i.test(type)) return 'error';
  if (/completed|result/i.test(type)) return 'completed';
  if (/started|running|resume/i.test(type)) return 'running';
  if (event?.event) return 'activity';
  return 'status';
}

module.exports = {
  eventPhase,
  normalizeAgentEvent,
};
