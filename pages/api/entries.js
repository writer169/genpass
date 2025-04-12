import { connectToDatabase } from '../../lib/mongodb';
import mongoose from 'mongoose';

// Определяем схему один раз
const EntrySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  encryptedData: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Используем существующую модель или создаем новую
const Entry = mongoose.models.Entry || mongoose.model('Entry', EntrySchema);

export default async function handler(req, res) {
  await connectToDatabase();

  // Получение списка сохраненных записей
  if (req.method === 'GET') {
    try {
      const entries = await Entry.find({}, { name: 1, encryptedData: 1 });
      return res.status(200).json({ entries });
    } catch (error) {
      return res.status(500).json({ error: 'Ошибка при получении записей' });
    }
  }

  // Создание или обновление записи
  if (req.method === 'POST') {
    const { name, encryptedData } = req.body;

    if (!name || !encryptedData) {
      return res.status(400).json({ error: 'Отсутствует имя или зашифрованные данные' });
    }

    try {
      await Entry.findOneAndUpdate(
        { name },
        { encryptedData },
        { upsert: true, new: true }
      );

      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Ошибка при сохранении записи' });
    }
  }

  // Удаление записи
  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Отсутствует ID записи' });
    }

    try {
      await Entry.findByIdAndDelete(id);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Ошибка при удалении записи' });
    }
  }

  return res.status(405).json({ error: 'Метод не разрешен' });
}