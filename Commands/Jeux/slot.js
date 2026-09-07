const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');
const { sleep } = require('../../utils');

module.exports = {
  name: 'slot',
  description: 'Jouez aux machines à sous en misant des coins.',
  async execute(message, args) {
    const guildId = message.guild.id;

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
        .setTitle('Slots')
        .setDescription(`${message.author} vient de lancer les slots en misant ${amount} coins🪙.`)
        .setThumbnail('https://media.tenor.com/WUWygJ0Fwz8AAAAC/jago33-slot-machine.gif')
        .setFooter({ text: `${message.author.tag} | 10 secondes avant le résultat`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setColor(0x6b6de6);

      const sentEmbed = await message.reply({ embeds: [slotEmbed] });

      await sleep(10000);

      const result = Math.random() < 0.5;

      const resultEmbed = new EmbedBuilder()
      .setTitle('Slots')
      .setDescription(result ? `Vous avez gagné **${amount * 2}** coins🪙` : `Vous avez perdu **${amount}** coins🪙`)
      .setThumbnail('https://media.tenor.com/WUWygJ0Fwz8AAAAC/jago33-slot-machine.gif')
      .setFooter({text: `${message.author.tag} | ${result ? 'Gagné x2' : 'Perdu'}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setColor(result ? 0x4caf50 : 0xe91e63);

      if (result) {
        userCoins.coins += amount * 2;
        await userCoins.save();
      }

      message.reply({ embeds: [resultEmbed] });
    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors du jeu aux machines à sous.');
    }
  },
};
