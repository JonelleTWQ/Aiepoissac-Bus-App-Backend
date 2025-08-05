const mongoose = require('mongoose');

const MRTStationSchema = new mongoose.Schema({
  type: { type: String, required: true },          // MRT or LRT
  stationCode: { type: String, required: true, unique: true }, 
  stationName: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true }
});

module.exports = mongoose.model('MRTStation', MRTStationSchema);

// Attributes are based on frontend^