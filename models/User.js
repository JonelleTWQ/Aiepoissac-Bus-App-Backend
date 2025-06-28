const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  hashedPassword: { type: String, required: true },
});
//create person if they don't exist, or update if they alr do
//also hashed password

module.exports = mongoose.model('User', UserSchema);
