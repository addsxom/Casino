const DEFAULT_DYNAMIC_ACTIVITY = '{prefix}help for {users} users!';

const LEGACY_PREFIX_TOKEN = '${prefix}';
const LEGACY_USERS_TOKEN =
  '${bot.guilds.cache.reduce((acc, guild) => acc + guild.memberCount,0)}';

function getTotalUsers(bot) {
  return bot.guilds.cache.reduce(
    (total, guild) => total + guild.memberCount,
    0
  );
}

function normalizeActivityTemplate(value) {
  const text = String(value || '').trim();

  if (!text) return '';

  return text
    .replaceAll(LEGACY_PREFIX_TOKEN, '{prefix}')
    .replaceAll(LEGACY_USERS_TOKEN, '{users}');
}

function renderActivityText(template, bot, prefix = '+') {
  const normalized = normalizeActivityTemplate(template);

  return normalized
    .replaceAll('{prefix}', prefix || '+')
    .replaceAll('{users}', String(getTotalUsers(bot)));
}

module.exports = {
  DEFAULT_DYNAMIC_ACTIVITY,
  normalizeActivityTemplate,
  renderActivityText
};
