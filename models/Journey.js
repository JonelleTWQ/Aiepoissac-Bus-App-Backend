const mongoose = require('mongoose');

const SegmentSchema = new mongoose.Schema({
  journeyID: { type: String, required: true },
  sequence: { type: Number, required: true },              // order inside the journey
  serviceNo: { type: String, required: true },
  direction: { type: Number, required: true },
  originBusStopSequence: { type: Number, required: true },
  destinationBusStopSequence: { type: Number, required: true }
}, { _id: false });


const JourneySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  journeyID: { type: String, required: true, unique: true }, // still unique at the journey level
  description: { type: String, required: true },
  segments: {
    type: [SegmentSchema],
    validate: v => Array.isArray(v) && v.length > 0
  },
  savedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Journey', JourneySchema);