const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');
const { sleep } = require('../../utils');

const SLOT_CHANNEL_ID = '1546311653564620897';

module.exports = {
  name: 'slot',
  description: 'Jouez aux machines à sous en misant des coins.',
  async execute(message, args) {
    const guildId = message.guild.id;

    if (message.channel.id !== SLOT_CHANNEL_ID) {
      const warningMessage = await message.reply(
        `❌・Les slots sont uniquement disponibles dans <#${SLOT_CHANNEL_ID}>.\n🕒 Suppression dans **5 secondes**.`
      );

      for (let seconds = 4; seconds >= 1; seconds--) {
        await sleep(1000);
        await warningMessage.edit(
          `❌・Les slots sont uniquement disponibles dans <#${SLOT_CHANNEL_ID}>.\n🕒 Suppression dans **${seconds} seconde${seconds > 1 ? 's' : ''}**.`
        );
      }

      await sleep(1000);
      await warningMessage.delete().catch(() => {});
      await message.delete().catch(() => {});
      return;
    }

    try {
      const amount = parseInt(args[0]);

      if (isNaN(amount) || amount <= 0) {
        return message.reply('❌・Veuillez miser un montant valide de coins.');
      }

      let userCoins = await UserCoins.findOne({ userId: message.author.id, guildId });

      if (!userCoins || userCoins.coins < amount) {
        return message.reply('❌・Vous n\'avez pas assez de coins pour jouer.');
      }

      userCoins.coins -= amount;
      await userCoins.save();

      const slotEmbed = new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTitle('🎰  MACHINE À SOUS  🎰')
        .setDescription(
          `> **La machine tourne...**\n\n` +
          `💰 **Mise :** ${amount} coins🪙\n` +
          `🎯 **Gain possible :** ${amount * 2} coins🪙\n\n` +
          `╔══════════════╗\n` +
          `║  🎲  🎲  🎲  ║\n` +
          `╚══════════════╝\n\n` +
          `⏳ Résultat dans **5 secondes**...`
        )
        .setThumbnail('https://media.tenor.com/WUWygJ0Fwz8AAAAC/jago33-slot-machine.gif')
        .setFooter({ text: 'Kuromi Casino • Bonne chance 🍀' })
        .setColor(0x6b6de6);

      const sentEmbed = await message.reply({ embeds: [slotEmbed] });

      await sleep(5000);

      const result = Math.random() < 0.5;

      if (result) {
        userCoins.coins += amount * 2;
        await userCoins.save();
      }

      const resultEmbed = new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTitle(result ? '🎉  JACKPOT !  🎉' : '💀  PERDU...  💀')
        .setDescription(
          result
            ? `> **La machine s'arrête sur une combinaison gagnante !**\n\n` +
              `╔══════════════╗\n` +
              `║  💎  💎  💎  ║\n` +
              `╚══════════════╝\n\n` +
              `💰 **Mise :** ${amount} coins🪙\n` +
              `🏆 **Gain :** ${amount * 2} coins🪙\n` +
              `📈 **Bénéfice net :** +${amount} coins🪙`
            : `> **Pas de chance cette fois...**\n\n` +
              `╔══════════════╗\n` +
              `║  🍒  🔔  🍋  ║\n` +
              `╚══════════════╝\n\n` +
              `💸 **Mise perdue :** ${amount} coins🪙\n` +
              `🎰 Retente ta chance quand tu veux !`
        )
        .setThumbnail('https://media.tenor.com/WUWygJ0Fwz8AAAAC/jago33-slot-machine.gif')
        .setFooter({ text: result ? 'Kuromi Casino • Gagné x2 ✨' : 'Kuromi Casino • La prochaine sera la bonne 🍀' })
        .setColor(result ? 0x4caf50 : 0xe91e63);

      await sentEmbed.edit({ embeds: [resultEmbed] });
    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors du jeu aux machines à sous.');
    }
  },
};