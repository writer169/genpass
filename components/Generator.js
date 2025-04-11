import { useEffect, useState } from "react";
import Head from "next/head";

export default function Generator() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Создаем глобальный объект Module для Argon2
    window.Module = {
      isReady: false,
      locateFile: (path) => {
        console.log(`Loading file: ${path}`);
        return `/${path}`;  // Добавляем явный слеш для доступа из папки public
      },
      onRuntimeInitialized: () => {
        console.log("Argon2 module initialized");
        window.Module.isReady = true;
        document.getElementById("generateBtn").disabled = false;
        log("Модуль Argon2 загружен", true);
        setIsLoading(false);
      },
      print: (text) => {
        console.log(`Argon2 says: ${text}`);
      },
      printErr: (text) => {
        console.error(`Argon2 error: ${text}`);
        setError(`Ошибка инициализации: ${text}`);
      }
    };

    // Загружаем скрипт Argon2
    const script = document.createElement("script");
    script.src = "/argon2.js";
    script.onerror = (e) => {
      console.error("Failed to load Argon2 script", e);
      setError("Не удалось загрузить модуль Argon2");
      log("Ошибка загрузки модуля Argon2");
    };
    document.body.appendChild(script);

    // Проверяем спустя 5 секунд, загрузился ли модуль
    const timeout = setTimeout(() => {
      if (!window.Module || !window.Module.isReady) {
        console.warn("Argon2 module not loaded after 5 seconds");
        log("Argon2 не загрузился за 5 секунд. Проверьте консоль.");
      }
    }, 5000);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  // Ваш существующий код JSX и функции
  return (
    <>
      <Head>
        <title>Генератор паролей (Argon2)</title>
        <link rel="stylesheet" href="/styles.css" />
      </Head>
      <div className="container">
        <div className="card">
          <h1>Генератор паролей</h1>

          <div className="form-group">
            <label htmlFor="master">Мастер-фраза</label>
            <input type="password" id="master" placeholder="Введите секретную фразу" />
          </div>

          <div className="form-group">
            <label htmlFor="service">Сервис</label>
            <input type="text" id="service" placeholder="Например: google.com" />
          </div>

          <div className="row">
            <div className="col">
              <div className="form-group">
                <label htmlFor="account">Аккаунт</label>
                <input type="text" id="account" defaultValue="default" />
              </div>
            </div>
            <div className="col">
              <div className="form-group">
                <label htmlFor="device">Устройство</label>
                <input type="text" id="device" defaultValue="default" />
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col">
              <div className="form-group">
                <label htmlFor="version">Версия</label>
                <input type="text" id="version" defaultValue="00" maxLength={2} placeholder="00" />
              </div>
            </div>
            <div className="col">
              <div className="form-group">
                <label htmlFor="length">Длина</label>
                <input type="number" id="length" min={6} max={64} defaultValue={16} placeholder="16" />
              </div>
            </div>
          </div>

          <div className="checkbox-group">
            <div className="checkbox-item">
              <input type="checkbox" id="uppercase" defaultChecked />
              <label htmlFor="uppercase">A</label>
            </div>
            <div className="checkbox-item">
              <input type="checkbox" id="lowercase" defaultChecked />
              <label htmlFor="lowercase">a</label>
            </div>
            <div className="checkbox-item">
              <input type="checkbox" id="digits" defaultChecked />
              <label htmlFor="digits">1</label>
            </div>
            <div className="checkbox-item">
              <input type="checkbox" id="symbols" defaultChecked />
              <label htmlFor="symbols">!</label>
            </div>
          </div>

          <button 
            className="generate" 
            id="generateBtn" 
            onClick={generatePassword} 
            disabled={isLoading}
          >
            СГЕНЕРИРОВАТЬ ПАРОЛЬ
          </button>

          <div className="result-container">
            <input type="text" id="result" readOnly placeholder="Пароль будет здесь" />
            <button className="copy-btn" onClick={() => copyToClipboard('result')}>⧉</button>
          </div>
        </div>

        <div className="card">
          <div className="form-group">
            <label htmlFor="settings">Настройки</label>
            <textarea id="settings" placeholder="Здесь будут закодированные настройки"></textarea>
          </div>

          <div className="settings-actions">
            <button className="settings-btn" onClick={copySettings}>Копировать настройки</button>
            <button className="settings-btn" onClick={pasteSettings}>Применить настройки</button>
          </div>
        </div>

        <div className="status" id="status">
          {error ? error : isLoading ? "Инициализация..." : "Готово к работе"}
        </div>
      </div>
    </>
  );
}

// Вспомогательные функции, которые мы выносим за пределы компонента
function log(msg, isSuccess = false) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = msg;
    statusEl.className = isSuccess ? 'status success' : 'status';

    if (isSuccess) {
      setTimeout(() => {
        statusEl.className = 'status';
      }, 2000);
    }
  }
}

function getCharset() {
  let chars = '';
  if (document.getElementById('lowercase').checked) chars += 'abcdefghijkmnpqrstuvwxyz';
  if (document.getElementById('uppercase').checked) chars += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  if (document.getElementById('digits').checked) chars += '23456789';
  if (document.getElementById('symbols').checked) chars += '!@#$%&';
  return chars;
}

function hashToPassword(hash, length, charset) {
  return Array.from(hash).slice(0, length).map(b => charset[b % charset.length]).join('');
}

function stringToBytes(str) {
  return new TextEncoder().encode(str);
}

function getSettings() {
  return {
    account: document.getElementById("account").value,
    device: document.getElementById("device").value,
    version: document.getElementById("version").value,
    length: document.getElementById("length").value,
    lowercase: document.getElementById("lowercase").checked,
    uppercase: document.getElementById("uppercase").checked,
    digits: document.getElementById("digits").checked,
    symbols: document.getElementById("symbols").checked
  };
}

function applySettings(obj) {
  document.getElementById("account").value = obj.account || "default";
  document.getElementById("device").value = obj.device || "default";
  document.getElementById("version").value = obj.version || "00";
  document.getElementById("length").value = obj.length || 16;
  document.getElementById("lowercase").checked = obj.lowercase ?? true;
  document.getElementById("uppercase").checked = obj.uppercase ?? true;
  document.getElementById("digits").checked = obj.digits ?? true;
  document.getElementById("symbols").checked = obj.symbols ?? true;
}

function copySettings() {
  const settings = getSettings();
  const encoded = btoa(JSON.stringify(settings));
  navigator.clipboard.writeText(encoded).then(() => {
    document.getElementById("settings").value = encoded;
    log("Настройки скопированы", true);
  }).catch(() => {
    document.getElementById("settings").value = encoded;
    log("Скопируйте настройки вручную");
  });
}

function pasteSettings() {
  try {
    const text = document.getElementById("settings").value.trim();
    const decoded = JSON.parse(atob(text));
    applySettings(decoded);
    log("Настройки успешно применены", true);
  } catch (e) {
    log("Неверный формат настроек");
  }
}

function copyToClipboard(id) {
  const el = document.getElementById(id);
  el.select();
  document.execCommand("copy");
  log("Пароль скопирован в буфер обмена", true);
}

function generatePassword() {
  if (!window.Module || !window.Module.isReady) {
    log("Модуль Argon2 ещё загружается...");
    return;
  }

  const master = document.getElementById("master").value.trim();
  const service = document.getElementById("service").value.trim();
  if (!master || !service) {
    alert("Пожалуйста, заполните мастер-фразу и сервис");
    return;
  }

  const salt = service + ":" +
               document.getElementById("account").value + ":" +
               document.getElementById("device").value + ":" +
               document.getElementById("version").value;

  const charset = getCharset();
  const length = parseInt(document.getElementById("length").value) || 16;

  if (charset.length < 5) {
    alert("Выберите хотя бы один тип символов");
    return;
  }

  log("Генерация пароля...");

  try {
    let mod = window.Module;
    let pwdBytes = stringToBytes(master);
    let saltBytes = stringToBytes(salt);
    let pwdPtr = mod._malloc(pwdBytes.length);
    let saltPtr = mod._malloc(saltBytes.length);
    let hashPtr = mod._malloc(32);
    let encodedPtr = mod._malloc(512);

    new Uint8Array(mod.HEAPU8.buffer, pwdPtr, pwdBytes.length).set(pwdBytes);
    new Uint8Array(mod.HEAPU8.buffer, saltPtr, saltBytes.length).set(saltBytes);

    const result = mod._argon2_hash(
      3, 65536, 1,
      pwdPtr, pwdBytes.length,
      saltPtr, saltBytes.length,
      hashPtr, 32,
      encodedPtr, 512,
      2, 0x13
    );

    if (result !== 0) {
      log("Ошибка генерации: " + result);
      return;
    }

    const hash = new Uint8Array(mod.HEAPU8.buffer, hashPtr, 32);
    const password = hashToPassword(hash, length, charset);
    document.getElementById("result").value = password;
    log("Пароль успешно сгенерирован", true);

    mod._free(pwdPtr);
    mod._free(saltPtr);
    mod._free(hashPtr);
    mod._free(encodedPtr);
  } catch (e) {
    console.error("Error during password generation:", e);
    log("Ошибка при генерации пароля: " + e.message);
  }
}