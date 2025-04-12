import mongoose from 'mongoose';

const MONGO_URL = process.env.MONGODB_URI;

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGO_URL, {
      bufferCommands: false,
    }).then((mongoose) => mongoose);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

const EntrySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  encryptedData: { type: String, required: true },
});

const Entry = mongoose.models.Entry || mongoose.model('Entry', EntrySchema);

export default async function handler(req, res) {
  await connect();

  if (req.method === 'GET') {
    const entries = await Entry.find({}, { name: 1, encryptedData: 1 });
    return res.status(200).json({ entries });
  }

  if (req.method === 'POST') {
    const { name, encryptedData } = req.body;

    if (!name || !encryptedData) {
      return res.status(400).json({ error: 'Missing name or encryptedData' });
    }

    await Entry.findOneAndUpdate(
      { name },
      { encryptedData },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}