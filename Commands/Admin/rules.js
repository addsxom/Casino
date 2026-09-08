const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

module.exports = {
  name: 'rules',
  description: 'Envoie le règlement du serveur dans le salon actuel.',

  async execute(message) {
    if (!message.guild) return;

    const isAllowed =
      message.author.id === process.env.BUYER ||
      message.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isAllowed) {
      return message.reply(
        '❌・Tu dois être administrateur pour utiliser cette commande.'
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x6b6de6)
      .setTitle('📜 RÈGLEMENT DU SERVEUR')
      .setDescription(
        '**Bienvenue sur le serveur !**\n\n' +
        'Pour garder une communauté agréable et sécurisée, chaque membre doit respecter les règles ci-dessous. ' +
        'En cliquant sur **✅ Accepter**, tu confirmes avoir lu et accepté ce règlement.'
      )
      .addFields(
        {
          name: '🤝 1・Respect',
          value:
            'Respecte tous les membres. Les insultes, provocations, discriminations, menaces et comportements toxiques ne sont pas tolérés.'
        },
        {
          name: '💬 2・Spam & contenu',
          value:
            'Pas de spam, flood, mentions abusives, publicité non autorisée ou contenu inapproprié.'
        },
        {
          name: '🎰 3・Jeux & économie',
          value:
            'Toute tentative de triche, exploitation de bug, duplication, manipulation de l’économie ou contournement des limites du bot est interdite.'
        },
        {
          name: '🛡️ 4・Arnaques & sécurité',
          value:
            'Les arnaques, tentatives de vol de compte, liens malveillants, usurpations et demandes d’informations privées sont interdites.'
        },
        {
          name: '📂 5・Utilisation des salons',
          value:
            'Utilise chaque salon pour son usage prévu et respecte les indications données par le staff.'
        },
        {
          name: '👥 6・Comptes secondaires',
          value:
            'L’utilisation de comptes secondaires pour contourner une sanction, un cooldown, une limite ou obtenir un avantage est interdite.'
        },
        {
          name: '⚖️ 7・Staff & sanctions',
          value:
            'Respecte les décisions du staff. En cas de désaccord, utilise le support plutôt que de créer un conflit dans les salons publics.'
        },
        {
          name: '📌 8・Discord',
          value:
            'Les Conditions d’utilisation et règles communautaires de Discord doivent être respectées à tout moment.'
        }
      )
      .setFooter({
        text: 'Clique sur Accepter pour accéder au serveur',
        iconURL: message.client.user.displayAvatarURL({ dynamic: true })
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('rules_accept')
        .setLabel('Accepter')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
    );

    await message.delete().catch(() => {});

    return message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
};
