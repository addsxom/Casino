const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const {
  TICKET_TYPES,
  isStaff,
  getStaffRoles,
  makeTicketChannelName
} = require('../utils/ticketSystem.js');

function staffPermissionOverwrites(guild) {
  return getStaffRoles(guild).map(role => ({
    id: role.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ManageMessages
    ]
  }));
}

async function getOrCreateCategory(guild, bot, type) {
  let category = guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildCategory &&
      channel.name === type.categoryName
  );

  if (category) return category;

  category = await guild.channels.create({
    name: type.categoryName,
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      ...staffPermissionOverwrites(guild),
      {
        id: bot.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages
        ]
      }
    ],
    reason: 'Catégorie créée automatiquement par le système de tickets'
  });

  return category;
}

async function openTicket(bot, interaction) {
  await interaction.deferReply({ ephemeral: true });

  const typeKey = interaction.customId.replace('ticket_open_', '');
  const type = TICKET_TYPES[typeKey];

  if (!type) {
    return interaction.editReply('❌・Ce type de ticket est invalide.');
  }

  const guild = interaction.guild;

  const existingTicket = guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildText &&
      channel.topic?.includes(`ticketOwner:${interaction.user.id}`)
  );

  if (existingTicket) {
    return interaction.editReply(
      `❌・Tu as déjà un ticket ouvert : ${existingTicket}`
    );
  }

  const category = await getOrCreateCategory(guild, bot, type);

  const channel = await guild.channels.create({
    name: makeTicketChannelName(type.channelPrefix, interaction.user),
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `ticketOwner:${interaction.user.id};ticketType:${typeKey}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      ...staffPermissionOverwrites(guild),
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks
        ]
      },
      {
        id: bot.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages
        ]
      }
    ],
    reason: `Ticket ouvert par ${interaction.user.tag}`
  });

  const embed = new EmbedBuilder()
    .setTitle(`${type.emoji} ${type.label}`)
    .setDescription(
      `Bienvenue ${interaction.user}.\n\n` +
      'Explique ta demande avec le plus de détails possible. ' +
      'Un membre du staff te répondra ici.'
    )
    .setColor(0x6b6de6)
    .setFooter({
      text: 'Kuromi Support',
      iconURL: bot.user.displayAvatarURL({ dynamic: true })
    });

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Fermer le ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `${interaction.user}`,
    embeds: [embed],
    components: [closeRow]
  });

  return interaction.editReply(
    `✅・Ton ticket a été créé : ${channel}`
  );
}

async function closeTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.channel;
  const ownerId = channel?.topic?.match(/ticketOwner:(\d+)/)?.[1];

  if (!ownerId) {
    return interaction.editReply(
      '❌・Ce salon ne semble pas être un ticket valide.'
    );
  }

  const member = await interaction.guild.members
    .fetch(interaction.user.id)
    .catch(() => interaction.member);

  if (interaction.user.id !== ownerId && !isStaff(member)) {
    return interaction.editReply(
      '❌・Seul le propriétaire du ticket ou le staff peut le fermer.'
    );
  }

  await interaction.editReply('🔒・Fermeture du ticket...');

  setTimeout(() => {
    channel
      .delete(`Ticket fermé par ${interaction.user.tag}`)
      .catch(error => console.error('Erreur fermeture ticket :', error));
  }, 1000);
}

module.exports = async (bot, interaction) => {
  if (!interaction.isButton() || !interaction.guild) return;

  try {
    if (interaction.customId.startsWith('ticket_open_')) {
      return await openTicket(bot, interaction);
    }

    if (interaction.customId === 'ticket_close') {
      return await closeTicket(interaction);
    }
  } catch (error) {
    console.error('Erreur système de tickets :', error);

    if (interaction.deferred || interaction.replied) {
      return interaction
        .editReply('❌・Une erreur est survenue avec le système de tickets.')
        .catch(() => {});
    }

    return interaction
      .reply({
        content: '❌・Une erreur est survenue avec le système de tickets.',
        ephemeral: true
      })
      .catch(() => {});
  }
};
