const mongoose = require('mongoose');

const JourneySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  originStopCode: String,
  destinationStopCode: String,
  journeyName: String,
  preferences: Object,
  savedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Journey', JourneySchema);