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

/////////////////
// User routes //
/////////////////

app.post('/api/users', async (req, res) => {
  const { userId, name, email } = req.body;
  const user = await User.findOneAndUpdate({ userId }, { name, email }, { upsert: true, new: true });
  res.json(user);
});
app.get('/api/users/:userId', async (req, res) => {
  const user = await User.findOne({ userId: req.params.userId });
  res.json(user || {});
});

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
  const { userId, journeyName, segments } = req.body;
  if (!Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: "A journey must have at least one segment." });
  }
  try {
    const newJourney = await Journey.create({ userId, journeyName, segments });
    res.json(newJourney);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't save journey!" });
  }
});

app.get('/api/journeys/:userId', async (req, res) => {
  const journeys = await Journey.find({ userId: req.params.userId });
  res.json(journeys);
});

app.delete('/api/journeys/:id', async (req, res) => {
  const deleted = await Journey.findByIdAndDelete(req.params.id);
  if (deleted) res.json({ message: 'Journey deleted' });
  else res.status(404).json({ error: 'Not found' });
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