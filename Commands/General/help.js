const { ButtonBuilder, ActionRowBuilder } = require("discord.js");
const Discord = require("discord.js");
const fs = require("fs");
const ServerPrefix = require("../../Models/ServerPrefix");

const categories = {
  General:
    "Les paramètres peuvent être des noms, des mentions, ou des IDs\nSi ce ne sont pas des mentions ils doivent être séparés par ``,,``",
  Rewards:
    "Les paramètres peuvent être des noms, des mentions, ou des IDs\nSi ce ne sont pas des mentions ils doivent être séparés par ``,,``",
  "Gestion Coins":
    "Les paramètres peuvent être des noms, des mentions, ou des IDs\nSi ce ne sont pas des mentions ils doivent être séparés par ``,,``",
  Minijeux:
    "Les paramètres peuvent être des noms, des mentions, ou des IDs\nSi ce ne sont pas des mentions ils doivent être séparés par ``,,``",
  Crew:
    "Les paramètres peuvent être des noms, des mentions, ou des IDs\nSi ce ne sont pas des mentions ils doivent être séparés par ``,,``",
  Admin:
    "Les paramètres peuvent être des noms, des mentions, ou des IDs\nSi ce ne sont pas des mentions ils doivent être séparés par ``,,``",
  Owner:
    "Les paramètres peuvent être des noms, des mentions, ou des IDs\nSi ce ne sont pas des mentions ils doivent être séparés par ``,,``",
};

module.exports = {
  name: "help",
  description: "Affiche la liste des commandes par catégorie",

  async execute(message) {
    const commandFiles = fs
      .readdirSync("./commands")
      .filter((file) => file.endsWith(".js"));

    const commandsByCategory = {};
    for (const file of commandFiles) {
      const command = require(`./${file}`);
      if (command.category && categories[command.category]) {
        if (!commandsByCategory[command.category]) {
          commandsByCategory[command.category] = [];
        }
        commandsByCategory[command.category].push(command);
      }
    }

    let prefix = process.env.PREFIX;
    if (message.guild) {
      const serverData = await ServerPrefix.findOne({
        guildId: message.guild.id,
      });
      if (serverData && serverData.prefix) {
        prefix = serverData.prefix;
      }
    }

    const embeds = [];
    for (const categoryName in categories) {
      const categoryDescription = categories[categoryName];
      const categoryCommands = commandsByCategory[categoryName] || [];

      const embed = new Discord.EmbedBuilder()
        .setTitle(`${categoryName}`)
        .setDescription(categoryDescription)
        .setColor(0x6b6de6)
        .setFooter({
          text: `${message.client.user.username} • Préfixe actuel : ${prefix}`,
        });

      if (categoryCommands.length > 0) {
        let commandList = categoryCommands
          .map((command) => `${command.name} - ${command.description}`)
          .join("\n\n");
        if (commandList.trim() !== "") {
          embed.addFields({ name: "Commandes", value: commandList });
        }
      }
      const diff = "``";

      if (categoryName === "General") {
        embed.setDescription(`
        ${diff}${prefix}ping${diff}\nVoir la latence du bot\n\n${diff}${prefix}uptime${diff}\nVoir depuis combien de temps le bot est en ligne\n\n${diff}${prefix}kuromibots${diff}\nAvoir le serveur support des bots kuromi\n

        `);
      } else if (categoryName === "Rewards") {
        embed.setDescription(`
        ${diff}${prefix}daily/dy${diff}\nnéclamez votre récompense quotidienne\n\n${diff}${prefix}work/wk${diff}\nRéclamez votre récompense par heures\n
        `);
      } else if (categoryName === "Gestion Coins") {
        embed.setDescription(`
        ${diff}${prefix}coins${diff}\nObternir votre profil\n\n${diff}${prefix}rob <@user/Id>${diff}\nVoler des coins a un utilisateur\n\n${diff}${prefix}dep <nombre de coins>${diff}\nDéposez votre coins de poche dans la banque\n\n${diff}${prefix}depall${diff}\nDéposez tous vos coins dans la banque\n\n${diff}${prefix}pay${diff}\nEnvoyer des coins a un utilisateur\n\n${diff}${prefix}ret <nombre de coins>${diff}\nRetirez vos coins de la banque\n\n${diff}${prefix}retall${diff}\nRetirez tous vos coins de la banque\n
        `);
      } else if (categoryName === "Minijeux") {
        embed.setDescription(`
        ${diff}${prefix}slot <nombre de coins>${diff}\nJouer au slots en mettant un nombre de coins\n\n${diff}${prefix}slotall${diff}\nJouer au slots en mettant tous vos coins\n
        `);
      } else if (categoryName === "Crew") {
        embed.setDescription(`
        ${diff}${prefix}cacc${diff}\nPermet d'accepter l'invitation a un crew\n\n${diff}${prefix}ccreate${diff}\nPermet de creer un crew avec un nom et une photo de profil personaliser\n\n${diff}${prefix}cdelete${diff}\nPermet de suprimer son crew\n\n${diff}${prefix}cedit${diff}\nPermet de modifier le nom ou la photo de profil de son crew\n\n${diff}${prefix}cinfo/cinfo <@user/userid>${diff}\nPermet de voir tout les information sur son crew ou sur le crew d'une autre personne\n\n${diff}${prefix}cinvite${diff}\nPermet d'inviter un membre qui nais dans aucun crew dans votre crew\n\n${diff}${prefix}cleave${diff}\nPermet de quitter un crew\n
        `);
      } else if (categoryName === "Admin") {
        embed.setDescription(`
        ${diff}${prefix}add <type(rep/bank/coins)> <nombre> <@utilisateur>${diff}\nAjouter des rep/bank/coins a un membre\n\n${diff}${prefix}remove <type(rep/coins)> <nombre> <@utilisateur>${diff}\nRetirer des rep/coins a un membre\n\n${diff}${prefix}reset <@utilisateur>${diff}\nRetirer tout les coins a un membre\n\n${diff}${prefix}resetuser${diff}\nRetirer tout les rep/coins au membre du serveur\n
        `);
      } else if (categoryName === "Owner") {
        embed.setDescription(`
        ${diff}${prefix}owner/unowner${diff}\nAjouter/retirer un membre en owner bot\n\n${diff}${prefix}stream/play/listen/watch <message>${diff}\nChanger l'activité du bot, le [text] peut contenir plusieurs phrases séparées par , , qui alterneront dans le profil du bot\n\n${diff}${prefix}online/idle/dnd${diff}\nChanger le statut du bot\n\n${diff}${prefix}set <name/pic>${diff}\nChanger le nom ou la photo profil du bot\n\n${diff}${prefix}joinvc <ID de la voc>${diff}\nFaire rejoindre le bot dans un canal vocal\n\n${diff}${prefix}theme <couleur>${diff}\nChanger la couleur de l'embed du bot\n
        `);
      }

      embeds.push(embed);
    }
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("previous")
        .setLabel("◀")
        .setStyle("Primary"),
      new ButtonBuilder().setCustomId("next").setLabel("▶").setStyle("Primary")
    );

    let currentPage = 0;
    const maxPage = embeds.length - 1;

    const messageData = {
      embeds: [embeds[currentPage]],
      components: [buttonRow],
    };

    const messageSent = await message.channel.send(messageData);

    const filter = (i) => i.customId === "previous" || i.customId === "next";

    const collector = messageSent.createMessageComponentCollector({
      filter,
      time: 300000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== message.author.id) {
        i.reply({
          content: "Vous n'êtes pas autorisé à utiliser cette message",
          ephemeral: true,
        });
        return;
      }

      if (i.customId === "previous") {
        if (currentPage === 0) {
          currentPage = maxPage;
        } else {
          currentPage--;
        }
      } else if (i.customId === "next" && currentPage < maxPage) {
        currentPage++;
      } else {
        currentPage = 0;
      }

      messageData.embeds = [embeds[currentPage]];
      await i.update(messageData);
    });

    collector.on("end", () => {
      messageSent.edit({ components: [] }).catch(console.error);
    });
  },
};
