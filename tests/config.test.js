const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config/botConfig.js');
const {
  CHANNEL_CONFIGS,
  resolveConfigKey,
  getConfiguredChannelId,
  getConfiguredChannelIds,
  getChannelConfigList
} = require('../utils/configService.js');

test('important config aliases resolve correctly', () => {
  assert.equal(resolveConfigKey('mines'), 'mines');
  assert.equal(resolveConfigKey('slot'), 'slots');
  assert.equal(resolveConfigKey('reward-voc'), 'rewards');
  assert.equal(resolveConfigKey('economy-logs'), 'economylogs');
  assert.equal(resolveConfigKey('voicebot'), 'botvoice');
  assert.equal(resolveConfigKey('afk'), 'afkfarm');
  assert.equal(resolveConfigKey('afk-farm'), 'afkfarm');
  assert.equal(resolveConfigKey('vocfarm'), 'voicefarm');
  assert.equal(resolveConfigKey('voice-farm'), 'voicefarm');
  assert.equal(resolveConfigKey('unknown-setting'), null);
});

test('channel config list exposes every registered key', () => {
  const list = getChannelConfigList('test-guild');

  assert.equal(list.length, Object.keys(CHANNEL_CONFIGS).length);

  for (const item of list) {
    assert.ok(item.key);
    assert.ok(item.label);
    assert.ok(['text', 'voice', 'any'].includes(item.type));
    assert.ok(['guild', 'global'].includes(item.scope));
  }
});

test('default channel ids are used without an override', () => {
  assert.equal(
    getConfiguredChannelId('mines', 'unconfigured-guild'),
    config.channels.games.mines
  );

  assert.equal(
    getConfiguredChannelId('slots', 'unconfigured-guild'),
    config.channels.games.slots
  );

  assert.equal(
    getConfiguredChannelId('unknown', 'unconfigured-guild'),
    null
  );
});

test('reward channel and voice farm configuration use ids', () => {
  assert.equal(
    getConfiguredChannelId('rewards', 'unconfigured-guild'),
    config.channels.rewards
  );

  assert.deepEqual(
    getConfiguredChannelIds('voicefarm', 'unconfigured-guild'),
    []
  );

  const voiceFarmEntry =
    getChannelConfigList('unconfigured-guild')
      .find(entry => entry.key === 'voicefarm');

  assert.equal(voiceFarmEntry.multiple, true);
  assert.equal(voiceFarmEntry.type, 'voice');
  assert.deepEqual(voiceFarmEntry.ids, []);
});


test('reward safety settings stay centralized', () => {
  assert.equal(config.rewards.messages.minimumCharacters, 3);
  assert.equal(config.rewards.voice.minimumHumans, 2);
  assert.equal(config.rewards.voice.rewardMinMs, 15 * 60 * 1000);
  assert.equal(config.rewards.voice.rewardMaxMs, 20 * 60 * 1000);
  assert.equal(config.rewards.voice.muteGraceRewards, 2);
  assert.equal(config.rewards.voice.activityBonusPercent, 50);
  assert.equal(config.rewards.afk.rewardMinMs, 30 * 60 * 1000);
  assert.equal(config.rewards.afk.rewardMaxMs, 40 * 60 * 1000);
  assert.equal(config.rewards.afk.rewardCoins, 250);
  assert.equal(config.channels.afkFarm, '1547368687579955290');
});
