const { getVoiceConnection, joinVoiceChannel } = require("@discordjs/voice");

const { requireBotOwner } = require('../../utils/ownerPermissions.js');

module.exports = {
  name: "joinvc",
  description: "Rejoindre un canal vocal",

  async execute(message, args) {
    const server = message.guild;
    if (!server) return;
    if (!(await requireBotOwner(message))) return;

const voiceChannelId = args[0];

    if (!voiceChannelId) {
      return message.channel.send(
        "Veuillez fournir l'ID du canal vocal pour utiliser cette commande."
      );
    }

    const voiceChannel = message.guild.channels.cache.get(voiceChannelId);

    if (!voiceChannel) {
      return message.channel.send("Le canal vocal spécifié est introuvable.");
    }

    const existingConnection = getVoiceConnection(message.guild.id);

    if (existingConnection) {
      if (existingConnection.joinConfig.channelId === voiceChannelId) {
        return message.channel.send(
          "Le bot est déjà connecté à ce canal vocal."
        );
      } else {
        existingConnection.destroy();
      }
    }

    const voiceConnection = joinVoiceChannel({
      channelId: voiceChannelId,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    voiceConnection.on("ready", () => {
      message.channel.send("Le bot a rejoint le canal vocal avec succès.");
    });
  },
};
