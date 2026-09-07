const mongoose = require('mongoose');

const userWorkCooldownSchema = new mongoose.Schema({
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
    default: 60 * 60 * 1000,
  },
});

const userWorkCooldown = mongoose.model('userWorkCooldown', userWorkCooldownSchema);

module.exports = userWorkCooldown;
