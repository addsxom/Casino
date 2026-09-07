const mongoose = require('mongoose');

const userCoinsSchema = new mongoose.Schema({
  userId: {
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
  messages: {
    type: Number,
    default: 0,
  },
});

userCoinsSchema.methods.checkMessageThreshold = async function () {
  const messageThresholds = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
  const coinsPerThresholds = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];

  for (let i = 0; i < messageThresholds.length; i++) {
    const messageThreshold = messageThresholds[i];
    const coinsPerThreshold = coinsPerThresholds[i];

    if (this.messages % messageThreshold === 0) {
      this.bank += coinsPerThreshold;
      await this.save();

      return {
        coins: coinsPerThreshold,
        threshold: messageThreshold,
      };
    }
  }

  return null;
};

module.exports = mongoose.model('UserCoins', userCoinsSchema);