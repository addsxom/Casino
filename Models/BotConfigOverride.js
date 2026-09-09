const mongoose = require('mongoose');

const botConfigOverrideSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model(
  'BotConfigOverride',
  botConfigOverrideSchema
);
