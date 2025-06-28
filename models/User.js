const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: String,
  email: String
});

module.exports = mongoose.model('User', UserSchema);
