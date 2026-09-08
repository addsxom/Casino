const { EmbedBuilder } = require('discord.js');
const { updateMemberCount } = require('../utils/updateMemberCount.js');
const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

const WELCOME_CHANNEL_ID = '1546311653388189718';

module.exports = async (_bot, member) => {
  await updateMemberCount(member.guild);

  try {
    const welcomeChannel =
      member.guild.channels.cache.get(WELCOME_CHANNEL_ID) ||
      await member.guild.channels.fetch(WELCOME_CHANNEL_ID);

    if (welcomeChannel?.isTextBased?.()) {
      const rulesChannel = member.guild.channels.cache.find(
        channel =>
          channel?.isTextBased?.() &&
          String(channel.name || '').toLowerCase().endsWith('rules')
      );

      const rulesMention = rulesChannel
        ? `${rulesChannel}`
        : '**#rules**';

      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x6b6de6)
        .setAuthor({
          name: 'Nouveau membre',
          iconURL: member.guild.iconURL({ dynamic: true }) || undefined
        })
        .setTitle(`Bienvenue ${member.user.username} !`)
        .setDescription(
          `${member.user}, bienvenue sur **${member.guild.name}** !\n\n` +
          `Avant de commencer, prends quelques secondes pour lire le règlement du serveur.\n\n` +
          `Rendez-vous dans ${rulesMention}\n` +
          `Lis le règlement puis clique sur **Accepter**\n` +
          `Tu recevras automatiquement le rôle **Member**\n` +
          `Tu auras ensuite accès au reste du serveur\n\n` +
          `**Bonne découverte et amuse-toi bien parmi nous !**`
        )
        .setThumbnail(
          member.user.displayAvatarURL({
            dynamic: true,
            size: 256
          })
        )
        .addFields(
          {
            name: 'Membre',
            value: `Tu es le **#${member.guild.memberCount}** membre du serveur.`,
            inline: true
          },
          {
            name: 'Compte créé',
            value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
            inline: true
          }
        )
        .setFooter({
          text: `${member.guild.name} • Bienvenue !`,
          iconURL: member.guild.iconURL({ dynamic: true }) || undefined
        })
        .setTimestamp();

      await welcomeChannel.send({
        content: `${member.user}`,
        embeds: [welcomeEmbed]
      });
    }
  } catch (error) {
    console.error(
      'Erreur message de bienvenue :',
      error?.code || error?.message || error
    );
  }

  await sendStaffLog(
    member.guild,
    'server-logs',
    buildDiscordLog({
      title: '📥 Arrivée',
      description:
        `${member.user} a rejoint le serveur.\n` +
        `-# ${member.guild.memberCount} membres • Compte créé <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
      color: 0x57f287
    })
  );
};
