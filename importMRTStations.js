const csv = require('csv-parser');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();
const MRTStation = require('./models/MRTStation');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected!"))
  .catch(err => console.error("MongoDB connection error.", err));

const results = [];

// csv with no header row
fs.createReadStream('MRT_Stations.csv')
  .pipe(csv({
    headers: ['type', 'stationCode', 'stationName', 'latitude', 'longitude'], 
    skipLines: 0 // since there is no header to skip
  }))
  .on('data', (data) => {
    // convert numeric fields
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);

    if (!data.type || !data.stationCode || !data.stationName || isNaN(lat) || isNaN(lng)) {
      console.warn("Skipping row with missing fields:", data);
      return;
    }

    results.push({
      type: data.type.trim(),
      stationCode: data.stationCode.trim(),
      stationName: data.stationName.trim(),
      latitude: lat,
      longitude: lng
    });
  })
  .on('end', async () => {
    try {
      await MRTStation.deleteMany({}); // clear old stations
      await MRTStation.insertMany(results);
      console.log(`✅ Imported ${results.length} MRT stations successfully!`);
      mongoose.connection.close();
    } catch (err) {
      console.error(err);
      mongoose.connection.close();
    }
  });
