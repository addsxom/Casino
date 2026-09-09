const test = require('node:test');
const assert = require('node:assert/strict');

const transcriptService =
  require('../utils/ticketTranscript.js');

test('ticket transcript service loads with installed package', () => {
  assert.equal(
    typeof transcriptService.createTicketTranscript,
    'function'
  );

  assert.equal(
    typeof transcriptService.deliverTicketTranscript,
    'function'
  );

  assert.equal(
    typeof transcriptService.deleteTicketChannel,
    'function'
  );
});

test('ticket closure lock prevents duplicate closures', () => {
  const channelId =
    '123456789012345678';

  assert.equal(
    transcriptService.tryLockTicketClosure(channelId),
    true
  );

  assert.equal(
    transcriptService.tryLockTicketClosure(channelId),
    false
  );

  transcriptService.releaseTicketClosure(channelId);

  assert.equal(
    transcriptService.tryLockTicketClosure(channelId),
    true
  );

  transcriptService.releaseTicketClosure(channelId);
});
