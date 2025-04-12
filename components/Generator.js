import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import CryptoJS from "crypto-js"; // Keep if needed elsewhere, otherwise remove

export default function Generator() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter(); // Keep if needed elsewhere, otherwise remove

  useEffect(() => {
    if (window.Module?.isReady) {
      setIsLoading(false);

      const savedSettings = localStorage.getItem("passwordSettings");
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          applySettings(settings);
          localStorage.removeItem("passwordSettings");
          log("Настройки успешно применены", true);
        } catch (e) {
          console.error("Ошибка при применении настроек:", e);
          log("Ошибка при применении настроек");
        }
      }

      return;
    }

    setIsLoading(true);
    const script = document.createElement("script");
    script.src = "/argon2.js";
    script.async = true;

    script.onload = () => {
      if (!window.Module) {
        console.error("window.Module не определён");
        log("Ошибка загрузки модуля Argon2");
        setIsLoading(false);
        return;
      }

      window.Module.onRuntimeInitialized = () => {
        console.log("Argon2 готов");
        window.Module.isReady = true;
        setIsLoading(false);

        const savedSettings = localStorage.getItem("passwordSettings");
        if (savedSettings) {
          try {
            const settings = JSON.parse(savedSettings);
            applySettings(settings);
            localStorage.removeItem("passwordSettings");
            log("Настройки успешно применены", true);
          } catch (e) {
            console.error("Ошибка при применении настроек:", e);
            log("Ошибка при применении настроек");
          }
        }
      };
    };

    script.onerror = () => {
      console.error("Ошибка загрузки скрипта argon2.js");
      log("Ошибка загрузки скрипта");
      setIsLoading(false);
    };

    document.body.appendChild(script);
  }, []);


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

          {/* Button group removed */}
          {/* <div className="button-group"> ... </div> */}
        </div>


        <div className="status" id="status">
          {error ? error : isLoading ? "Инициализация..." : "Готово к работе"}
        </div>

        {/* Save Modal removed */}
        {/* {showSaveModal && ( ... )} */}
      </div>
    </>
  );
}


function log(msg, isSuccess = false) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = msg;
    statusEl.className = isSuccess ? 'status success' : 'status';

    if (isSuccess) {
      setTimeout(() => {
        if (statusEl.className === 'status success') { // Check if still success
             statusEl.textContent = "Готово к работе"; // Reset text or leave as is
             statusEl.className = 'status';
        }
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
    service: document.getElementById("service").value,
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
  if (obj.service) {
    document.getElementById("service").value = obj.service;
  }
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
  // Assuming there's an input with id="settings" somewhere else or this function is now unused
  const settingsInput = document.getElementById("settings");
  navigator.clipboard.writeText(encoded).then(() => {
    if (settingsInput) settingsInput.value = encoded;
    log("Настройки скопированы", true);
  }).catch(() => {
    if (settingsInput) settingsInput.value = encoded;
    log("Скопируйте настройки вручную");
  });
}


function pasteSettings() {
    // Assuming there's an input with id="settings" somewhere else or this function is now unused
    const settingsInput = document.getElementById("settings");
    if (!settingsInput) {
        log("Элемент для вставки настроек не найден");
        return;
    }
  try {
    const text = settingsInput.value.trim();
    const decoded = JSON.parse(atob(text));
    applySettings(decoded);
    log("Настройки успешно применены", true);
  } catch (e) {
    log("Неверный формат настроек");
  }
}


function copyToClipboard(id) {
  const el = document.getElementById(id);
   if (!el || !el.value) {
       log("Нечего копировать");
       return;
   }
  el.select();
  try {
    document.execCommand("copy");
    log("Пароль скопирован в буфер обмена", true);
  } catch (err) {
    log("Ошибка копирования");
    console.error("Copy error:", err);
  }
  // Deselect text after copying
  if (window.getSelection) {
     window.getSelection().removeAllRanges();
  } else if (document.selection) {
     document.selection.empty();
  }
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

  if (length < 6 || length > 64) {
     alert("Длина пароля должна быть от 6 до 64 символов");
     return;
  }

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
    let hashPtr = mod._malloc(32); // Argon2 output size = 32 bytes
    let encodedPtr = mod._malloc(512); // Buffer for encoded hash string (not strictly needed for password derivation)

    new Uint8Array(mod.HEAPU8.buffer, pwdPtr, pwdBytes.length).set(pwdBytes);
    new Uint8Array(mod.HEAPU8.buffer, saltPtr, saltBytes.length).set(saltBytes);

    const result = mod._argon2_hash(
      3, // t_cost (iterations)
      65536, // m_cost (memory in KiB)
      1, // parallelism
      pwdPtr, pwdBytes.length,
      saltPtr, saltBytes.length,
      hashPtr, 32, // Raw hash output
      encodedPtr, 512, // Encoded output buffer (optional usage)
      2, // Argon2d=0, Argon2i=1, Argon2id=2
      0x13 // Version 1.3
    );

    if (result !== 0) {
       // Try to get error message if possible (depends on argon2.js build)
       let errorMsg = "Код ошибки: " + result;
       if (mod.ccall) { // Check if ccall is available
           try {
             errorMsg = mod.ccall('argon2_error_message', 'string', ['number'], [result]);
           } catch(e) { console.error("Could not get Argon2 error message", e)}
       }
      log("Ошибка генерации: " + errorMsg);
      // Free memory even on error
      mod._free(pwdPtr);
      mod._free(saltPtr);
      mod._free(hashPtr);
      mod._free(encodedPtr);
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
     // Ensure memory is freed in case of JS error after malloc
     if (window.Module?._free) {
         // Attempt to free if pointers were allocated, might need try-catch around each _free
         // It's safer if the pointers are managed within the try block scope
     }
  }
}