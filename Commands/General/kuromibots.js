const Discord = require("discord.js");

module.exports = {
  name: "kuromibots",
  description: "Donne une invitation pour le serveur de support Kuromi.",
  async execute(message, args) {

    const supportMessage = '**<a:b_kuromi5:1176626430877106216>・Support Bots : https://discord.gg/kuromibots **'

    message.channel.send(supportMessage);
  },
};
