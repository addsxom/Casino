const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TICKET_TYPES,
  getTicketOwnerId,
  getTicketTypeKey,
  isTicketChannel
} = require('../utils/ticketSystem.js');

test('ticket metadata is parsed from channel topic', () => {
  const channel = {
    topic:
      'ticketOwner:123456789012345678;ticketType:report'
  };

  assert.equal(
    getTicketOwnerId(channel),
    '123456789012345678'
  );

  assert.equal(
    getTicketTypeKey(channel),
    'report'
  );

  assert.equal(
    isTicketChannel(channel),
    true
  );
});

test('normal channels are not treated as tickets', () => {
  const channel = {
    topic: 'ordinary channel'
  };

  assert.equal(
    getTicketOwnerId(channel),
    null
  );

  assert.equal(
    getTicketTypeKey(channel),
    null
  );

  assert.equal(
    isTicketChannel(channel),
    false
  );
});

test('ticket types use configurable category ids', () => {
  assert.equal(
    TICKET_TYPES.general.categoryConfigKey,
    'ticketsupport'
  );
  assert.equal(
    TICKET_TYPES.report.categoryConfigKey,
    'ticketreports'
  );
  assert.equal(
    TICKET_TYPES.other.categoryConfigKey,
    'ticketrequests'
  );
});
