// models/PasswordEntry.js
import mongoose from 'mongoose';

const PasswordEntrySchema = new mongoose.Schema({
  name: String,
  encryptedData: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.PasswordEntry || mongoose.model('PasswordEntry', PasswordEntrySchema);