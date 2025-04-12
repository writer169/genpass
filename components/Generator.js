import { useEffect, useState } from 'react';
import argon2 from '../public/argon2.js';

export default function Generator() {
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [passphrase, setPassphrase] = useState('');
  const [decryptedEntries, setDecryptedEntries] = useState([]);
  const [formData, setFormData] = useState({ name: '', salt: '', length: 12 });

  // Загрузка записей из базы
  useEffect(() => {
    fetch('/api/entries')
      .then(res => res.json())
      .then(data => setEntries(data.entries));
  }, []);

  // Расшифровка
  const decryptData = async () => {
    const decrypted = await Promise.all(entries.map(async entry => {
      try {
        const key = await getKey(passphrase, entry.name);
        const decrypted = await decrypt(entry.encryptedData, key);
        return { ...JSON.parse(decrypted), id: entry._id };
      } catch (e) {
        return null;
      }
    }));
    setDecryptedEntries(decrypted.filter(Boolean));
  };

  // При выборе карточки — загрузка параметров
  const loadEntry = (entry) => {
    setSelected(entry.id);
    setFormData(entry);
  };

  // Генерация пароля (по соли и мастер-фразе)
  const generatePassword = async () => {
    const hash = await argon2.hash({
      pass: passphrase,
      salt: formData.salt,
      hashLen: formData.length,
      time: 2,
      mem: 1024,
      parallelism: 1,
      type: argon2.ArgonType.Argon2id
    });
    alert('Пароль: ' + hash.encoded);
  };

  // Сохранение в базу
  const saveEntry = async () => {
    const key = await getKey(passphrase, formData.name);
    const encrypted = await encrypt(JSON.stringify(formData), key);
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: formData.name, encryptedData: encrypted }),
    });
    alert('Сохранено!');
  };

  return (
    <div className="p-4">
      <h2 className="text-xl mb-2">Ввод мастер-фразы</h2>
      <input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} />
      <button onClick={decryptData}>Расшифровать</button>

      <h2 className="text-xl mt-4">Записи</h2>
      <div className="grid grid-cols-2 gap-4">
        {decryptedEntries.map(entry => (
          <div key={entry.id} onClick={() => loadEntry(entry)} className="border p-2 cursor-pointer">
            <strong>{entry.name}</strong><br />
            Соль: {entry.salt}<br />
            Длина: {entry.length}
          </div>
        ))}
      </div>

      <h2 className="text-xl mt-4">{selected ? 'Редактировать' : 'Новая'} запись</h2>
      <input placeholder="Имя" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
      <input placeholder="Соль" value={formData.salt} onChange={e => setFormData({ ...formData, salt: e.target.value })} />
      <input type="number" value={formData.length} onChange={e => setFormData({ ...formData, length: +e.target.value })} />
      <div className="flex gap-2 mt-2">
        <button onClick={generatePassword}>Сгенерировать</button>
        <button onClick={saveEntry}>Сохранить</button>
      </div>
    </div>
  );
}

// Шифрование и дешифровка

async function getKey(passphrase, name) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", enc.encode(passphrase + name), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("some-salt"), // лучше заменить
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(text, key) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );
  const buf = new Uint8Array(ciphertext);
  const combined = new Uint8Array(iv.length + buf.length);
  combined.set(iv);
  combined.set(buf, iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encoded, key) {
  const data = atob(encoded).split('').map(c => c.charCodeAt(0));
  const iv = new Uint8Array(data.slice(0, 12));
  const ciphertext = new Uint8Array(data.slice(12));
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}