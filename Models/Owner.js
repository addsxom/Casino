const mongoose = require('mongoose');

const ownerSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
});

const Owner = mongoose.model('Owner', ownerSchema);

module.exports = Owner;
