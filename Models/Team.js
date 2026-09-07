const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  guildId: { type: String, required: true, },
  name: { type: String, required: true },
  ownerId: { type: String, required: true },
  timestamp: { type: Date, required: true },
  members: [
    {
      userId: { type: String, required: true },
      role: { type: String, enum: ['Leader', 'Co-Leader', 'Ancien', 'Employer', 'Membre'], default: 'Membre' },
      permissions: {
        manageTeam: { type: Boolean, default: false },
        retCoins: { type: Boolean, default: false },
        depCoins: { type: Boolean, default: false },
        addMember: { type: Boolean, default: false },
        removeMember: { type: Boolean, default: false },
      },
    },
  ],
  icon: { type: String },
});

const Team = mongoose.model('Team', teamSchema);

module.exports = Team;
