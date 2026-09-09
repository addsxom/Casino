const Discord = require("discord.js");

const { replyEmbedPayload } = require('../../utils/replyEmbed.js');

module.exports = {
  name: "kuromibots",
  description: "Donne une invitation pour le serveur de support Kuromi.",
  async execute(message, args) {

    return message.channel.send(
      replyEmbedPayload(
        '<a:b_kuromi5:1176626430877106216> **Support Bots**\nhttps://discord.gg/kuromibots',
        {
          type: 'info',
          title: '💬 Serveur de support'
        }
      )
    );
  },
};
