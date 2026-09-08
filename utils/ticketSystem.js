const { PermissionFlagsBits } = require('discord.js');

const TICKET_TYPES = {
  general: {
    label: 'Aide générale',
    emoji: '❓',
    categoryName: '🎫・Support général',
    channelPrefix: 'support'
  },
  report: {
    label: 'Signalement',
    emoji: '🚨',
    categoryName: '🚨・Signalements',
    channelPrefix: 'signalement'
  },
  other: {
    label: 'Autre demande',
    emoji: '📩',
    categoryName: '📩・Autres demandes',
    channelPrefix: 'ticket'
  }
};

function isStaff(member) {
  if (!member?.permissions) return false;

  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.permissions.has(PermissionFlagsBits.ModerateMembers)
  );
}

function getStaffRoles(guild) {
  return guild.roles.cache.filter(role => {
    if (role.id === guild.id || role.managed) return false;

    return (
      role.permissions.has(PermissionFlagsBits.Administrator) ||
      role.permissions.has(PermissionFlagsBits.ManageChannels) ||
      role.permissions.has(PermissionFlagsBits.ModerateMembers)
    );
  });
}

function makeTicketChannelName(prefix, user) {
  const username = (user.globalName || user.username || user.id)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 55);

  return `${prefix}-${username || user.id.slice(-6)}`.slice(0, 95);
}

module.exports = {
  TICKET_TYPES,
  isStaff,
  getStaffRoles,
  makeTicketChannelName
};
