require('dotenv').config();
//purpose of .env file: security and for impt stuff
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');
//rmb to capitalise! e.g. Customers
const Journey = require('./models/Journey');
const Preference = require('./models/Preference');
//tells u where the thing goes
const bcrypt = require('bcrypt');
const saltRounds = 10;
//smth about cost factor (i.e. "how much time is needed to 
//calculate a single BCrypt hash"), which I will leave alone

const app = express();
app.use(cors());
app.use(express.json());

//////////////////////////////////
// Creates a MongoDB connection //
//////////////////////////////////

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected!")) //if it works
  .catch(err => console.error("MongoDB connection error.", err)); //catch the error otherwise

//////////////////
// Call LTA API //
//////////////////

app.get('/api/bus-arrival/:busStopCode', async (req, res) => {
  try {
    const response = await axios.get(`https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${req.params.busStopCode}`, {
      headers: { AccountKey: process.env.LTA_API_KEY }
    }); //From the LTA DataMall API User Guide!
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'LTA API error.' });
  }
});


/////////////////////////////////////
// LTA STATIC DATA PROXY ENDPOINTS //
/////////////////////////////////////

const LTA_BASE = 'https://datamall2.mytransport.sg/ltaodataservice';

// GET /api/lta/bus-stops?skip=0
app.get('/api/lta/bus-stops', async (req, res) => {
  const skip = Number(req.query.skip) || 0;
  try {
    const { data } = await axios.get(`${LTA_BASE}/BusStops?$skip=${skip}`, {
      headers: { AccountKey: process.env.LTA_API_KEY, accept: 'application/json' }
    });
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch BusStops' });
  }
});

// GET /api/lta/bus-routes?skip=0
app.get('/api/lta/bus-routes', async (req, res) => {
  const skip = Number(req.query.skip) || 0;
  try {
    const { data } = await axios.get(`${LTA_BASE}/BusRoutes?$skip=${skip}`, {
      headers: { AccountKey: process.env.LTA_API_KEY, accept: 'application/json' }
    });
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch BusRoutes' });
  }
});

// GET /api/lta/bus-services?skip=0
app.get('/api/lta/bus-services', async (req, res) => {
  const skip = Number(req.query.skip) || 0;
  try {
    const { data } = await axios.get(`${LTA_BASE}/BusServices?$skip=${skip}`, {
      headers: { AccountKey: process.env.LTA_API_KEY, accept: 'application/json' }
    });
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch BusServices' });
  }
});


//////////////////////////
// MRT Stations routes  //
//////////////////////////

const MRTStation = require('./models/MRTStation');

// 1. GET all MRT stations
app.get('/api/mrt-stations', async (req, res) => {
  try {
    const stations = await MRTStation.find({});
    res.json(stations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't fetch MRT stations!" });
  }
});

// 2. INSERT a new MRT station (requires ?key=YOUR_SECRET_KEY)
app.post('/api/mrt-stations', async (req, res) => {
  const apiKey = req.query.key;
  if (apiKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden: Invalid API key >:(' });
  }

  const { type, stationCode, stationName, latitude, longitude } = req.body;
  if (!type || !stationCode || !stationName || latitude == null || longitude == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const newStation = await MRTStation.create({ type, stationCode, stationName, latitude, longitude });
    res.json(newStation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't insert MRT station!" });
  }
});

// 3. DELETE a MRT station by stationCode (requires ?key=YOUR_SECRET_KEY)
app.delete('/api/mrt-stations/:stationCode', async (req, res) => {
  const apiKey = req.query.key;
  if (apiKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden: Invalid API key >:(' });
  }

  try {
    const deleted = await MRTStation.findOneAndDelete({ stationCode: req.params.stationCode });
    if (!deleted) return res.status(404).json({ error: 'Station not found' });
    res.json({ message: 'Station deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't delete MRT station!" });
  }
});


/////////////////
// User routes //
/////////////////

/* app.post('/api/users', async (req, res) => {
  const { userId, name, email } = req.body;
  const user = await User.findOneAndUpdate({ userId }, { name, email }, { upsert: true, new: true });
  res.json(user);
});
app.get('/api/users/:userId', async (req, res) => {
  const user = await User.findOne({ userId: req.params.userId });
  res.json(user || {});
});

Note: Ignore these!

*/


/////////////////
// Preferences //
/////////////////

app.post('/api/preferences', async (req, res) => {
  const { userId, favBusStop } = req.body;
  const pref = await Preference.findOneAndUpdate({ userId }, { favBusStop }, { upsert: true, new: true });
  res.json(pref);
});
app.get('/api/preferences/:userId', async (req, res) => {
  const pref = await Preference.findOne({ userId: req.params.userId });
  res.json(pref || {});
});

//////////////
// Journeys //
//////////////

// helper!
function validateSegmentPayload(s) {
  return (
    typeof s.sequence === 'number' &&
    s.serviceNo &&
    typeof s.direction === 'number' &&
    typeof s.originBusStopSequence === 'number' &&
    typeof s.destinationBusStopSequence === 'number'
  );
}

// CREATE a new journey (segments are optional now)
app.post('/api/journeys', async (req, res) => {
  const { userId, journeyID, description, segments } = req.body;

  if (!userId || !journeyID || !description) {
    return res.status(400).json({ error: "userId, journeyID, and description are required." });
  }

  // Segments are optional, but if provided, must be an array
  if (segments && !Array.isArray(segments)) {
    return res.status(400).json({ error: "Segments must be an array if provided." });
  }

  // Validate each segment if provided
  if (segments && segments.some(s =>
    typeof s.sequence !== 'number' ||
    !s.serviceNo ||
    typeof s.direction !== 'number' ||
    typeof s.originBusStopSequence !== 'number' ||
    typeof s.destinationBusStopSequence !== 'number'
  )) {
    return res.status(400).json({ error: "One or more segments are missing required fields." });
  }

  try {
    const segmentsWithJourneyID = (segments || []).map(s => ({ ...s, journeyID }));
    const newJourney = await Journey.create({
      userId,
      journeyID,
      description,
      segments: segmentsWithJourneyID
    });

    res.json(newJourney);
  } catch (err) {
    console.error(err);
    // duplicate key error if same journeyID is re-used
    if (err.code === 11000) {
      return res.status(409).json({ error: "journeyID already exists" });
    }
    res.status(500).json({ error: "Couldn't save journey!" });
  }
});


// RENAME A JOURNEY AND/OR REPLACE ITS SEGMENTS
// PATCH /api/journeys/:id   (Mongo _id)
app.patch('/api/journeys/:id', async (req, res) => {
  const { description, segments } = req.body;

  if (segments) {
    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: "segments must be a non-empty array if provided." });
    }

    const invalid = segments.some(s =>
      typeof s.sequence !== 'number' ||
      !s.serviceNo ||
      typeof s.direction !== 'number' ||
      typeof s.originBusStopSequence !== 'number' ||
      typeof s.destinationBusStopSequence !== 'number'
    );
    if (invalid) {
      return res.status(400).json({ error: "One or more segments are missing required fields." });
    }
  }

  try {
    const existing = await Journey.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Journey not found" });
    }

    const update = {};
    if (description != null) update.description = description;
    if (segments != null) {
      update.segments = segments.map(s => ({ ...s, journeyID: existing.journeyID }));
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Provide at least one of: description or segments." });
    }

    const updated = await Journey.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't update journey!" });
  }
});



// REPLACE ONLY SEGMENTS
// PATCH /api/journeys/:id/segments
app.patch('/api/journeys/:id/segments', async (req, res) => {
  const { segments } = req.body;

  if (!Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: "segments must be a non-empty array." });
  }

  const invalid = segments.some(s =>
    typeof s.sequence !== 'number' ||
    !s.serviceNo ||
    typeof s.direction !== 'number' ||
    typeof s.originBusStopSequence !== 'number' ||
    typeof s.destinationBusStopSequence !== 'number'
  );
  if (invalid) {
    return res.status(400).json({ error: "One or more segments are missing required fields." });
  }

  try {
    const existing = await Journey.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Journey not found" });
    }

    const segmentsWithJourneyID = segments.map(s => ({ ...s, journeyID: existing.journeyID }));

    const updated = await Journey.findByIdAndUpdate(
      req.params.id,
      { $set: { segments: segmentsWithJourneyID } },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't update segments!" });
  }
});


////////////////////////////////////
// Journey endpoints by journeyID //
////////////////////////////////////

// GET one journey by its journeyID
app.get('/api/journeys/by-journey-id/:journeyID', async (req, res) => {
  try {
    const j = await Journey.findOne({ journeyID: req.params.journeyID });
    if (!j) return res.status(404).json({ error: "Journey not found" });
    res.json(j);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't fetch journey!" });
  }
});

// PATCH (rename and/or replace segments) by journeyID
app.patch('/api/journeys/by-journey-id/:journeyID', async (req, res) => {
  const { description, segments } = req.body;

  // validate segments if provided
  if (segments) {
    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: "segments must be a non-empty array if provided." });
    }

    const invalid = segments.some(s =>
      typeof s.sequence !== 'number' ||
      !s.serviceNo ||
      typeof s.direction !== 'number' ||
      typeof s.originBusStopSequence !== 'number' ||
      typeof s.destinationBusStopSequence !== 'number'
    );
    if (invalid) {
      return res.status(400).json({ error: "One or more segments are missing required fields." });
    }
  }

  try {
    const update = {};
    if (description != null) update.description = description;
    if (segments != null) update.segments = segments.map(s => ({ ...s, journeyID: req.params.journeyID }));

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Provide at least one of: description or segments." });
    }

    const updated = await Journey.findOneAndUpdate(
      { journeyID: req.params.journeyID },
      { $set: update },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Journey not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't update journey!" });
  }
});

// REPLACE ONLY SEGMENTS by journeyID
app.patch('/api/journeys/by-journey-id/:journeyID/segments', async (req, res) => {
  const { segments } = req.body;

  if (!Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: "segments must be a non-empty array." });
  }

  const invalid = segments.some(s =>
    typeof s.sequence !== 'number' ||
    !s.serviceNo ||
    typeof s.direction !== 'number' ||
    typeof s.originBusStopSequence !== 'number' ||
    typeof s.destinationBusStopSequence !== 'number'
  );
  if (invalid) {
    return res.status(400).json({ error: "One or more segments are missing required fields." });
  }

  try {
    const segmentsWithJourneyID = segments.map(s => ({ ...s, journeyID: req.params.journeyID }));
    const updated = await Journey.findOneAndUpdate(
      { journeyID: req.params.journeyID },
      { $set: { segments: segmentsWithJourneyID } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Journey not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't update segments!" });
  }
});

// DELETE by journeyID
app.delete('/api/journeys/by-journey-id/:journeyID', async (req, res) => {
  try {
    const deleted = await Journey.findOneAndDelete({ journeyID: req.params.journeyID });
    if (!deleted) return res.status(404).json({ error: "Journey not found" });
    res.json({ message: 'Journey deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't delete journey!" });
  }
});


//////////////////////////////////////////////
// Journey SEGMENT endpoints (by journeyID) //
//////////////////////////////////////////////

// 9.1 INSERT a new segment
app.post('/api/journeys/:journeyID/segments', async (req, res) => {
  const { journeyID } = req.params;
  const segment = req.body;

  if (!validateSegmentPayload(segment)) {
    return res.status(400).json({ error: 'Segment missing required fields.' });
  }

  try {
    const journey = await Journey.findOne({ journeyID });
    if (!journey) return res.status(404).json({ error: 'Journey not found' });

    if (journey.segments.some(s => s.sequence === segment.sequence)) {
      return res.status(409).json({ error: 'Segment with this sequence already exists.' });
    }

    journey.segments.push({ ...segment, journeyID });
    await journey.save();
    res.json(journey);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't insert segment!" });
  }
});

// 9.2 UPDATE a single segment (by sequence)
app.patch('/api/journeys/:journeyID/segments/:sequence', async (req, res) => {
  const { journeyID, sequence } = req.params;
  const payload = req.body;

  const fields = ['serviceNo', 'direction', 'originBusStopSequence', 'destinationBusStopSequence'];
  const invalid =
    Object.keys(payload).some(k => !fields.includes(k)) ||
    (payload.direction != null && typeof payload.direction !== 'number') ||
    (payload.originBusStopSequence != null && typeof payload.originBusStopSequence !== 'number') ||
    (payload.destinationBusStopSequence != null && typeof payload.destinationBusStopSequence !== 'number');

  if (invalid) {
    return res.status(400).json({ error: 'Invalid fields in payload.' });
  }

  try {
    const journey = await Journey.findOne({ journeyID });
    if (!journey) return res.status(404).json({ error: 'Journey not found' });

    const seq = Number(sequence);
    const idx = journey.segments.findIndex(s => s.sequence === seq);
    if (idx === -1) return res.status(404).json({ error: 'Segment not found' });

    journey.segments[idx] = {
      ...journey.segments[idx],
      ...payload,
      journeyID
    };

    await journey.save();
    res.json(journey);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't update segment!" });
  }
});

// 9.3 DELETE a single segment (by sequence)
app.delete('/api/journeys/:journeyID/segments/:sequence', async (req, res) => {
  const { journeyID, sequence } = req.params;

  try {
    const journey = await Journey.findOne({ journeyID });
    if (!journey) return res.status(404).json({ error: 'Journey not found' });

    const seq = Number(sequence);
    const before = journey.segments.length;
    journey.segments = journey.segments.filter(s => s.sequence !== seq);

    if (journey.segments.length === before) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    await journey.save({ validateModifiedOnly: true }).catch(async () => {
      await Journey.updateOne(
        { journeyID },
        { $set: { segments: journey.segments } },
        { runValidators: false }
      );
    });

    res.json(journey);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't delete segment!" });
  }
});

// 9.4 DELETE all segments in a journey
app.delete('/api/journeys/:journeyID/segments', async (req, res) => {
  const { journeyID } = req.params;

  try {
    const updated = await Journey.findOneAndUpdate(
      { journeyID },
      { $set: { segments: [] } },
      { new: true, runValidators: false }
    );

    if (!updated) return res.status(404).json({ error: 'Journey not found' });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't delete all segments!" });
  }
});

// 9.5 GET all segments of a journey
app.get('/api/journeys/:journeyID/segments', async (req, res) => {
  const { journeyID } = req.params;

  try {
    const journey = await Journey.findOne({ journeyID });
    if (!journey) return res.status(404).json({ error: 'Journey not found' });

    res.json(journey.segments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't get segments!" });
  }
});


// 10. GET all journeys for a user
app.get('/api/journeys/:userId', async (req, res) => {
  try {
    const journeys = await Journey.find({ userId: req.params.userId });
    res.json(journeys);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't fetch journeys!" });
  }
});


///////////////
// Get thing //
///////////////

app.get('/', (_, res) => res.send('Server running...'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

//after running on terminal, test with:
//http://localhost:3000/api/bus-arrival/83139

//for everything else, rmb to use yay.js for start command

////////////////////////////
// Registering a new user //
////////////////////////////

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ error: 'Username already taken :(' });

  const hashedPassword = await bcrypt.hash(password, saltRounds);
  const user = await User.create({ username, hashedPassword });
  res.status(201).json({ message: 'You registered successfully!' });
});

///////////////////
// When Login in //
///////////////////

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: 'User does not exist!' });

  const match = await bcrypt.compare(password, user.hashedPassword);
  if (!match) return res.status(401).json({ error: 'Wrong password!' });
  res.json({ message: 'Login successful!', userId: user._id });
});

//////////////////////////
// Change User Password //
//////////////////////////

app.post('/api/change-password', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  if (!username || !oldPassword || !newPassword) {
    return res.status(400).json({ error: 'username, oldPassword, and newPassword are required' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'User not found :/' });

    // Verify old password
    const match = await bcrypt.compare(oldPassword, user.hashedPassword);
    if (!match) return res.status(401).json({ error: 'Old password is incorrect! >:(' });

    // Hash and update to new password
    const newHashedPassword = await bcrypt.hash(newPassword, saltRounds);
    user.hashedPassword = newHashedPassword;
    await user.save();

    res.json({ message: 'Password changed successfully! :)' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password :(' });
  }
});
