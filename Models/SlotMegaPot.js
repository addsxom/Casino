const mongoose = require('mongoose');

const slotMegaPotSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    default: 0,
    min: 0
  }
});

slotMegaPotSchema.index(
  { guildId: 1 },
  { unique: true, name: 'slot_megapot_guild_unique' }
);

module.exports = mongoose.model(
  'SlotMegaPot',
  slotMegaPotSchema
);
