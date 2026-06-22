const { createId } = require('./id');

function createPanelTicketService({ ttlMs = 30 * 1000 } = {}) {
  const tickets = new Map();

  function createTicket(pageSessionId) {
    const value = createId('ticket');
    const ticket = {
      value,
      pageSessionId,
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
    return ticket.pageSessionId;
  }

  return {
    createTicket,
    consumeTicket,
  };
}

module.exports = {
  createPanelTicketService,
};
