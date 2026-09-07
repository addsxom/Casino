const mongoose = require('mongoose');

const userRepCooldownSchema = new mongoose.Schema({
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
    default: 120 * 60 * 1000,
  },
});

const UserRepCooldown = mongoose.model('UserRepCooldown', userRepCooldownSchema);

module.exports = UserRepCooldown;
