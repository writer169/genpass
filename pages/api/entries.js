// Обновление в pages/api/entries.js
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

  // Получение списка сохраненных записей или проверка существования по имени
  if (req.method === 'GET') {
    try {
      // Если указано имя, проверяем существование записи
      if (req.query.name) {
        const entryExists = await Entry.exists({ name: req.query.name });
        // Приводим результат к булевому типу на всякий случай (хотя exists должен вернуть null или объект)
        return res.status(200).json({ exists: !!entryExists });
      }
      
      // Иначе возвращаем все записи (только имя и зашифрованные данные)
      const entries = await Entry.find({}, { name: 1, encryptedData: 1 });
      return res.status(200).json({ entries });
    } catch (error) {
      console.error('Ошибка при получении записей:', error); // Логируем ошибку для отладки
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
      // Используем findOneAndUpdate с опцией upsert: true.
      // Это найдет запись по имени и обновит ее, или создаст новую, если не найдена.
      // Опция new: true возвращает обновленный (или созданный) документ, но мы его не используем здесь.
      await Entry.findOneAndUpdate(
        { name }, // Условие поиска
        { encryptedData }, // Данные для обновления или создания
        { upsert: true, new: true, setDefaultsOnInsert: true } // Опции: создать если нет, вернуть новый, установить значения по умолчанию при вставке
      );

      return res.status(200).json({ success: true, message: `Запись '${name}' успешно сохранена/обновлена.` });
    } catch (error) {
      console.error('Ошибка при сохранении записи:', error); // Логируем ошибку
      // Проверяем на ошибку дубликата ключа (если вдруг unique constraint сработал до findOneAndUpdate)
      if (error.code === 11000) {
         return res.status(409).json({ error: `Запись с именем '${name}' уже существует.` });
      }
      return res.status(500).json({ error: 'Ошибка при сохранении записи' });
    }
  }

  // Удаление записи
  if (req.method === 'DELETE') {
    // Удаляем по имени, а не по ID, для консистентности с остальным API
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: 'Отсутствует имя записи для удаления' });
    }

    try {
      const result = await Entry.deleteOne({ name });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: `Запись с именем '${name}' не найдена.` });
      }
      return res.status(200).json({ success: true, message: `Запись '${name}' успешно удалена.` });
    } catch (error) {
      console.error('Ошибка при удалении записи:', error); // Логируем ошибку
      return res.status(500).json({ error: 'Ошибка при удалении записи' });
    }
  }

  // Если метод не GET, POST или DELETE
  return res.status(405).setHeader('Allow', ['GET', 'POST', 'DELETE']).json({ error: `Метод ${req.method} не разрешен` });
}