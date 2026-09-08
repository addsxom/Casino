const { updateMemberCount } = require('../utils/updateMemberCount.js');

module.exports = async (_bot, member) => {
  await updateMemberCount(member.guild);
};
