// pages/api/save.js
import { connectToDatabase } from '../../lib/mongodb';
import PasswordEntry from '../../models/PasswordEntry';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.split(' ')[1];
  try {
    jwt.verify(token, process.env.JWT_SECRET); // используешь тот же секрет, что и в login.js
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { title, encryptedData, salt } = req.body;

  if (!title || !encryptedData || !salt)
    return res.status(400).json({ error: 'Missing fields' });

  await connectToDatabase();

  const entry = new PasswordEntry({ title, encryptedData, salt });
  await entry.save();

  res.status(200).json({ message: 'Saved' });
}