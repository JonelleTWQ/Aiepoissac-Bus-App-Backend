const mongoose = require('mongoose');

const SegmentSchema = new mongoose.Schema({
  sequence: { type: Number, required: true },              // order inside the journey
  serviceNo: { type: String, required: true },
  direction: { type: Number, required: true },
  originBusStopSequence: { type: Number, required: true },
  destinationBusStopSequence: { type: Number, required: true }
}, { _id: false });
// each segment has service number, direction, and origin/destination stop sequence


const JourneySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  journeyID: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  segments: {
    type: [SegmentSchema],
    validate: v => Array.isArray(v) && v.length > 0
  },
  savedAt: { type: Date, default: Date.now }
});
// then each saved journey has segments
// and the journey is saved to the user id

module.exports = mongoose.model('Journey', JourneySchema);