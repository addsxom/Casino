const mongoose = require('mongoose');

const activeGameSessionSchema =
  new mongoose.Schema({
    userId: {
      type: String,
      required: true
    },
    guildId: {
      type: String,
      required: true
    },
    game: {
      type: String,
      required: true,
      enum: [
        'slots',
        'mines',
        'crash'
      ]
    },
    refundableAmount: {
      type: Number,
      required: true,
      min: 0
    },
    originalAmount: {
      type: Number,
      required: true,
      min: 0
    }
  }, {
    timestamps: true
  });

activeGameSessionSchema.index(
  { userId: 1, guildId: 1 },
  {
    unique: true,
    name:
      'active_game_session_user_guild_unique'
  }
);

module.exports = mongoose.model(
  'ActiveGameSession',
  activeGameSessionSchema
);
