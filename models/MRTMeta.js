const mongoose = require('mongoose');

const MRTMetaSchema = new mongoose.Schema({
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MRTMeta', MRTMetaSchema);
