const test = require('node:test');
const assert = require('node:assert/strict');

const {
  tryAcquireActiveGame,
  updateActiveGame,
  releaseActiveGame
} = require('../utils/activeGameLock.js');

test('one user cannot start two games in the same guild', () => {
  const userId = 'test-user-lock-1';
  const guildId = 'test-guild-lock-1';

  const first = tryAcquireActiveGame({
    userId,
    guildId,
    game: 'Mines',
    channelId: 'channel-a'
  });

  assert.equal(first.acquired, true);

  const second = tryAcquireActiveGame({
    userId,
    guildId,
    game: 'Crash',
    channelId: 'channel-b'
  });

  assert.equal(second.acquired, false);
  assert.equal(second.activeGame.game, 'Mines');

  assert.equal(
    releaseActiveGame({
      userId,
      guildId,
      token: first.token
    }),
    true
  );
});

test('game lock update and release are token safe', () => {
  const userId = 'test-user-lock-2';
  const guildId = 'test-guild-lock-2';

  const lock = tryAcquireActiveGame({
    userId,
    guildId,
    game: 'Slots',
    channelId: 'channel-a'
  });

  assert.equal(lock.acquired, true);

  assert.equal(
    updateActiveGame({
      userId,
      guildId,
      token: 'wrong-token',
      messageId: 'message-x'
    }),
    false
  );

  assert.equal(
    updateActiveGame({
      userId,
      guildId,
      token: lock.token,
      channelId: 'channel-b',
      messageId: 'message-y'
    }),
    true
  );

  assert.equal(
    releaseActiveGame({
      userId,
      guildId,
      token: 'wrong-token'
    }),
    false
  );

  assert.equal(
    releaseActiveGame({
      userId,
      guildId,
      token: lock.token
    }),
    true
  );
});

test('the same user can have independent locks in different guilds', () => {
  const userId = 'test-user-lock-3';

  const first = tryAcquireActiveGame({
    userId,
    guildId: 'guild-a',
    game: 'Mines',
    channelId: 'channel-a'
  });

  const second = tryAcquireActiveGame({
    userId,
    guildId: 'guild-b',
    game: 'Crash',
    channelId: 'channel-b'
  });

  assert.equal(first.acquired, true);
  assert.equal(second.acquired, true);

  releaseActiveGame({
    userId,
    guildId: 'guild-a',
    token: first.token
  });

  releaseActiveGame({
    userId,
    guildId: 'guild-b',
    token: second.token
  });
});
