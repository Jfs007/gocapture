const { createId } = require('./id');

function createPanelTicketService({ ttlMs = 30 * 1000 } = {}) {
  const tickets = new Map();

  function createTicket(input) {
    const pageSessionId = typeof input === 'string' ? input : input?.pageSessionId;
    const workspaceId = typeof input === 'string' ? '' : (input?.workspaceId || '');
    const value = createId('ticket');
    const ticket = {
      value,
      pageSessionId,
      workspaceId,
      expiresAt: Date.now() + ttlMs,
      consumed: false,
    };
    tickets.set(value, ticket);
    return {
      panelTicket: value,
      expiresAt: ticket.expiresAt,
    };
  }

  function consumeTicket(value) {
    const ticket = tickets.get(value);
    if (!ticket) throw new Error('Panel ticket not found.');
    if (ticket.consumed) throw new Error('Panel ticket has been consumed.');
    if (ticket.expiresAt < Date.now()) {
      tickets.delete(value);
      throw new Error('Panel ticket expired.');
    }
    ticket.consumed = true;
    return {
      pageSessionId: ticket.pageSessionId,
      workspaceId: ticket.workspaceId,
    };
  }

  return {
    createTicket,
    consumeTicket,
  };
}

module.exports = {
  createPanelTicketService,
};
