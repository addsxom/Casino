const mongoose = require('mongoose');

const voiceRewardProgressSchema = new mongoose.Schema({
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
  mutedMs: {
    type: Number,
    default: 0
  },
  mutedRewards: {
    type: Number,
    default: 0
  },
  previousSelfMute: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

voiceRewardProgressSchema.index(
  { userId: 1, guildId: 1 },
  {
    unique: true,
    name: 'voice_reward_progress_user_guild_unique'
  }
);

module.exports = mongoose.model(
  'VoiceRewardProgress',
  voiceRewardProgressSchema
);
