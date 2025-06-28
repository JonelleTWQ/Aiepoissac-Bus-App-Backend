const mongoose = require('mongoose');

const PreferenceSchema = new mongoose.Schema({
  userId: String,
  favBusStop: String
});

module.exports = mongoose.model('Preference', PreferenceSchema);