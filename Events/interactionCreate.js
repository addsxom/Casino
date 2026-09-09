const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');

const {
  TICKET_TYPES,
  isStaff,
  getStaffRoles,
  isTicketChannel,
  makeTicketChannelName
} = require('../utils/ticketSystem.js');

const { replyEmbedPayload } = require('../utils/replyEmbed.js');

const MEMBER_ROLE_NAME = 'Member';

async function acceptRules(interaction) {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  const member = await interaction.guild.members
    .fetch(interaction.user.id)
    .catch(() => interaction.member);

  await interaction.guild.roles.fetch().catch(() => null);

  const memberRole = interaction.guild.roles.cache.find(
    role => role.name.toLowerCase() === MEMBER_ROLE_NAME.toLowerCase()
  );

  if (!memberRole) {
    return interaction.editReply(
      replyEmbedPayload(
        'Le rôle **Member** est introuvable. Contacte un administrateur.',
        { type: 'error' }
      )
    );
  }

  if (member.roles.cache.has(memberRole.id)) {
    return interaction.editReply(
      replyEmbedPayload(
        'Tu as déjà accepté le règlement et tu possèdes déjà le rôle **Member**.',
        { type: 'success', title: '✅ Règlement déjà accepté' }
      )
    );
  }

  if (!memberRole.editable) {
    return interaction.editReply(
      replyEmbedPayload(
        'Je ne peux pas attribuer le rôle **Member**. Mon rôle doit être placé au-dessus dans la hiérarchie.',
        { type: 'error' }
      )
    );
  }

  await member.roles.add(
    memberRole,
    'Règlement accepté'
  );

  return interaction.editReply(
    replyEmbedPayload(
      'Le rôle **Member** t’a été attribué. Bienvenue sur le serveur.',
      { type: 'success', title: '✅ Règlement accepté' }
    )
  );
}

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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const typeKey = interaction.customId.replace('ticket_open_', '');
  const type = TICKET_TYPES[typeKey];

  if (!type) {
    return interaction.editReply(
      replyEmbedPayload(
        'Ce type de ticket est invalide.',
        { type: 'error' }
      )
    );
  }

  const guild = interaction.guild;

  const existingTicket = guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildText &&
      channel.topic?.includes(`ticketOwner:${interaction.user.id}`)
  );

  if (existingTicket) {
    return interaction.editReply(
      replyEmbedPayload(
        `Tu as déjà un ticket ouvert : ${existingTicket}`,
        { type: 'warning', title: '🎫 Ticket déjà ouvert' }
      )
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

  await interaction.editReply(
    replyEmbedPayload(
      `Ton ticket a été créé : ${channel}`,
      { type: 'success', title: '🎫 Ticket créé' }
    )
  );

  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, 3000);

  return;
}

async function closeTicket(interaction) {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  // Charge le générateur de transcript uniquement lors de la fermeture.
  // Ainsi, un module de transcript absent/cassé ne désactive pas
  // tout interactionCreate et n'empêche pas l'ouverture des tickets.
  const {
    tryLockTicketClosure,
    releaseTicketClosure,
    deliverTicketTranscript,
    deleteTicketChannel
  } = require('../utils/ticketTranscript.js');

  const channel = interaction.channel;

  if (!isTicketChannel(channel)) {
    return interaction.editReply(
      replyEmbedPayload(
        'Ce salon ne semble pas être un ticket valide.',
        {
          type: 'error',
          title: '🎫 Ticket requis'
        }
      )
    );
  }

  const member =
    await interaction.guild.members
      .fetch(interaction.user.id)
      .catch(() => interaction.member);

  if (!isStaff(member)) {
    return interaction.editReply(
      replyEmbedPayload(
        'Seuls les modérateurs peuvent fermer un ticket.',
        {
          type: 'error',
          title: '🛡️ Permission requise'
        }
      )
    );
  }

  if (
    !tryLockTicketClosure(
      channel.id
    )
  ) {
    return interaction.editReply(
      replyEmbedPayload(
        'La fermeture de ce ticket est déjà en cours.',
        {
          type: 'warning',
          title: '🔒 Fermeture en cours'
        }
      )
    );
  }

  await interaction.editReply(
    replyEmbedPayload(
      'Je génère le transcript HTML complet du ticket avant sa fermeture.',
      {
        type: 'info',
        title: '📄 Création du transcript'
      }
    )
  );

  try {
    const result =
      await deliverTicketTranscript({
        channel,
        closedBy:
          interaction.user
      });

    await interaction.editReply(
      replyEmbedPayload(
        result.dmSent
          ? 'Le transcript a été envoyé en DM au créateur du ticket.\n\nSuppression du salon dans **2 secondes**.'
          : 'Les DM du créateur sont fermés ou indisponibles. Une copie du transcript a été envoyée au modérateur qui ferme le ticket.\n\nSuppression du salon dans **2 secondes**.',
        {
          type:
            result.dmSent
              ? 'success'
              : 'warning',
          title:
            result.dmSent
              ? '✅ Transcript envoyé'
              : '⚠️ DM indisponibles'
        }
      )
    );

    await new Promise(resolve =>
      setTimeout(resolve, 2000)
    );

    await deleteTicketChannel(
      channel,
      interaction.user
    );
  } catch (error) {
    console.error(
      'Erreur fermeture ticket :',
      error
    );

    releaseTicketClosure(
      channel.id
    );

    return interaction.editReply(
      replyEmbedPayload(
        'Impossible de générer ou d’envoyer le transcript. Le ticket n’a pas été supprimé.',
        {
          type: 'error',
          title: '❌ Fermeture annulée'
        }
      )
    ).catch(() => {});
  }

  releaseTicketClosure(
    channel.id
  );
}

module.exports = async (bot, interaction) => {
  if (!interaction.isButton() || !interaction.guild) return;

  try {
    if (interaction.customId === 'rules_accept') {
      return await acceptRules(interaction);
    }

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
        .editReply(
          replyEmbedPayload(
            'Une erreur est survenue avec le système de tickets.',
            { type: 'error' }
          )
        )
        .catch(() => {});
    }

    return interaction
      .reply({
        ...replyEmbedPayload(
          'Une erreur est survenue avec le système de tickets.',
          { type: 'error' }
        ),
        flags: MessageFlags.Ephemeral
      })
      .catch(() => {});
  }
};
