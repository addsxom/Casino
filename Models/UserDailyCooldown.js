const mongoose = require('mongoose');

const userDailyCooldownSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  cooldown: {
    type: Number,
    default: 10 * 60 * 60 * 1000,
  },
});

module.exports = mongoose.model('UserDailyCooldown', userDailyCooldownSchema);