const mongoose = require('mongoose');

const minesCooldownSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  revealAvailableAt: {
    type: Date,
    default: null,
  },
});

minesCooldownSchema.index(
  { userId: 1, guildId: 1 },
  { unique: true, name: 'mines_cooldown_user_guild_unique' }
);

module.exports = mongoose.model('MinesCooldown', minesCooldownSchema);
