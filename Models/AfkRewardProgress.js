const mongoose = require('mongoose');

const afkRewardProgressSchema =
  new mongoose.Schema({
    userId: {
      type: String,
      required: true
    },
    guildId: {
      type: String,
      required: true
    },
    validMs: {
      type: Number,
      default: 0
    },
    targetMs: {
      type: Number,
      required: true
    },
    statusMessageId: {
      type: String,
      default: null
    },
    suppressEligibleStatus: {
      type: Boolean,
      default: false
    }
  }, {
    timestamps: true
  });

afkRewardProgressSchema.index(
  { userId: 1, guildId: 1 },
  {
    unique: true,
    name: 'afk_reward_progress_user_guild_unique'
  }
);

module.exports = mongoose.model(
  'AfkRewardProgress',
  afkRewardProgressSchema
);
