const mongoose = require('mongoose');

const SegmentSchema = new mongoose.Schema({
  serviceNo: { type: String, required: true },
  originStopCode: { type: String, required: true },
  destinationStopCode: { type: String, required: true }
}, { _id: false });
// each segment of a saved journey has service no., origin stop code
// and destination stop code

const JourneySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  journeyName: { type: String, required: true },
  segments: [SegmentSchema],
  savedAt: { type: Date, default: Date.now }
});
// then each saved journey has segments
// and the journey is saved to the user id

module.exports = mongoose.model('Journey', JourneySchema);