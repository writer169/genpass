// components/Generator.js
import { useState, useEffect } from 'react';

export default function Generator() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/argon2.js';
    script.async = true;
    script.onload = () => {
      console.log('Argon2 script loaded');
      setIsReady(true);
    };
    script.onerror = (e) => {
      console.error('Failed to load Argon2 script', e);
      setError('Не удалось загрузить модуль Argon2');
    };
    document.body.appendChild(script);
  }, []);

  const generatePassword = async () => {
    if (!isReady || !window.Argon2) {
      setError('Модуль Argon2 ещё не загружен');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const passwordInput = 'masterpassword'; // Замени на свой ввод
      const salt = encoder.encode('mysalt');  // Замени на свой ввод

      const hash = await window.Argon2.hash({
        pass: passwordInput,
        salt: salt,
        time: 3,
        mem: 65536,
        hashLen: 32,
        parallelism: 1,
        type: window.Argon2.ArgonType.Argon2id,
      });

      setPassword(hash.encoded);
    } catch (e) {
      console.error(e);
      setError('Ошибка генерации пароля');
    }
  };

  return (
    <div className="generator">
      <h1>Генератор паролей</h1>
      <button onClick={generatePassword}>Сгенерировать</button>
      {password && <p>Пароль: <code>{password}</code></p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}