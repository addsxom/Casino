const MEMBER_COUNT_CHANNEL_ID = '1546311653388189716';

async function updateMemberCount(guild) {
  if (!guild) return;

  try {
    const channel = await guild.channels.fetch(MEMBER_COUNT_CHANNEL_ID);

    if (!channel) {
      console.error('Salon compteur de membres introuvable.');
      return;
    }

    const memberCount = guild.memberCount;
    const newName = `👥・Membres : ${memberCount}`;

    if (channel.name !== newName) {
      await channel.setName(newName, 'Mise à jour automatique du nombre de membres');
    }
  } catch (error) {
    console.error('Erreur compteur de membres :', error);
  }
}

module.exports = {
  updateMemberCount,
  MEMBER_COUNT_CHANNEL_ID
};
