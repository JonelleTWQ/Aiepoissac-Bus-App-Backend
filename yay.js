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

app.post('/api/journeys', async (req, res) => {
  const { userId, journeyID, description, segments } = req.body;

  if (!userId || !journeyID || !description) {
    return res.status(400).json({ error: "userId, journeyID, and description are required." });
  }

  if (!Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: "A journey must have at least one segment." });
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
    const segmentsWithJourneyID = segments.map(s => ({ ...s, journeyID }));
    const newJourney = await Journey.create({ userId, journeyID, description, segments: segmentsWithJourneyID });

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