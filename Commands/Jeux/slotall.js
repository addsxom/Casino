const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');
const { sleep } = require('../../utils');

const SLOT_CHANNEL_ID = '1546311653564620897';

const SLOT_GIF = 'https://media.tenor.com/WUWygJ0Fwz8AAAAC/jago33-slot-machine.gif';
const WIN_GIF = 'https://media.giphy.com/media/Vu5UbNpjpqfMq2UFg0/giphy.gif';
const LOSE_GIF = 'https://media.giphy.com/media/eJ4j2VnYOZU8qJU3Py/giphy.gif';

module.exports = {
  name: 'slotall',
  description: 'Jouez aux machines à sous en misant tous vos coins.',

  async execute(message) {
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
      let userCoins = await UserCoins.findOne({
        userId: message.author.id,
        guildId
      });

      if (!userCoins || userCoins.coins <= 0) {
        return message.reply('❌・Vous n\'avez pas assez de coins pour jouer.');
      }

      const amount = userCoins.coins;

      userCoins.coins = 0;
      await userCoins.save();

      const slotEmbed = new EmbedBuilder()
        .setTitle('Slots')
        .setDescription(
          `${message.author} vient de lancer les slots en misant **tous ses coins : ${amount} coins🪙**.`
        )
        .setImage(SLOT_GIF)
        .setFooter({
          text: `${message.author.tag} | 5 secondes avant le résultat`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setColor(0x6b6de6);

      const sentEmbed = await message.reply({ embeds: [slotEmbed] });

      await sleep(5000);

      const result = Math.random() < 0.5;

      if (result) {
        userCoins.coins += amount * 3;
        await userCoins.save();
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle(result ? '🎉 YOU WIN' : '💀 YOU LOSE')
        .setDescription(
          result
            ? `Vous avez gagné **${amount * 3}** coins🪙`
            : `Vous avez perdu **${amount}** coins🪙`
        )
        .setImage(result ? WIN_GIF : LOSE_GIF)
        .setFooter({
          text: `${message.author.tag} | ${result ? 'Gagné x3' : 'Perdu'}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setColor(result ? 0x4caf50 : 0xe91e63);

      await sentEmbed.edit({ embeds: [resultEmbed] });

    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors du jeu aux machines à sous.');
    }
  },
};