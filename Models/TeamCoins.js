const mongoose = require('mongoose');

const teamCoinsSchema = new mongoose.Schema({
  team: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  coins: {
    type: Number,
    default: 0,
  },
  bank: {
    type: Number,
    default: 0,
  },
  rep: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model('TeamCoins', teamCoinsSchema);