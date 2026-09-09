const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config/botConfig.js');
const {
  CHANNEL_CONFIGS,
  resolveConfigKey,
  getConfiguredChannelId,
  getChannelConfigList
} = require('../utils/configService.js');

test('important config aliases resolve correctly', () => {
  assert.equal(resolveConfigKey('mines'), 'mines');
  assert.equal(resolveConfigKey('slot'), 'slots');
  assert.equal(resolveConfigKey('reward-voc'), 'rewards');
  assert.equal(resolveConfigKey('economy-logs'), 'economylogs');
  assert.equal(resolveConfigKey('voicebot'), 'botvoice');
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

test('reward safety settings stay centralized', () => {
  assert.equal(config.rewards.messages.minimumCharacters, 3);
  assert.equal(config.rewards.voice.minimumHumans, 2);
  assert.equal(config.rewards.voice.rewardMinMs, 15 * 60 * 1000);
  assert.equal(config.rewards.voice.rewardMaxMs, 20 * 60 * 1000);
  assert.equal(config.rewards.voice.muteGraceMs, 40 * 60 * 1000);
  assert.equal(config.rewards.voice.activityBonusPercent, 50);
});
