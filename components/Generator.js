import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import CryptoJS from "crypto-js";

export default function Generator() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // Removed state related to the old save modal
  // const [saveName, setSaveName] = useState("");
  // const [showSaveModal, setShowSaveModal] = useState(false);
  // const [saveSuccess, setSaveSuccess] = useState(false);
  const router = useRouter();

  // Добавляем новое состояние для показа/скрытия пароля
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // --- Argon2 Initialization Logic (unchanged) ---
    if (window.Module?.isReady) {
      console.log("Argon уже инициализирован");
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
        setError("Ошибка загрузки модуля Argon2"); // Set error state
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
      setError("Ошибка загрузки скрипта argon2.js"); // Set error state
      setIsLoading(false);
    };

    document.body.appendChild(script);

    // Cleanup function to remove script if component unmounts before load
    return () => {
        const existingScript = document.querySelector('script[src="/argon2.js"]');
        if (existingScript) {
            // Optional: try to clean up Module if possible, though often difficult
            // delete window.Module;
            // document.body.removeChild(existingScript);
            console.log("Generator unmounted, script cleanup attempted.");
        }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Модифицируем функцию saveSettings для автоматического именования
  const saveSettings = async () => {
    const master = document.getElementById("master").value.trim();
    if (!master) {
      alert("Пожалуйста, введите мастер-пароль для шифрования");
      return;
    }

    // Получаем настройки для сохранения
    const settings = getSettings();

    // Формируем имя на основе настроек
    let nameComponents = [];

    // Добавляем сервис (обязательно)
    if (!settings.service.trim()) {
      alert("Пожалуйста, введите название сервиса");
      return;
    }
    nameComponents.push(settings.service);

    // Добавляем аккаунт, если он не 'default'
    if (settings.account && settings.account.toLowerCase() !== 'default') {
      nameComponents.push(settings.account);
    }

    // Добавляем устройство, если оно не 'default'
    if (settings.device && settings.device.toLowerCase() !== 'default') {
      nameComponents.push(settings.device);
    }

    // Добавляем версию, если она не '00'
    if (settings.version && settings.version !== '00') {
      nameComponents.push(`v${settings.version}`);
    }

    let baseSaveName = nameComponents.join(' - ');
    let saveName = baseSaveName; // Start with the base name

    try {
      // Проверяем, существует ли запись с таким именем и генерируем уникальное имя
      let counter = 1;
      let nameToCheck = saveName;
      while (true) {
        const response = await fetch(`/api/entries?name=${encodeURIComponent(nameToCheck)}`);
        if (!response.ok) {
            // Handle server errors during check if necessary
            throw new Error(`Ошибка проверки имени: ${response.statusText}`);
        }
        const data = await response.json();

        if (!data.exists) {
          saveName = nameToCheck; // Found a unique name
          break;
        }

        // Name exists, increment counter and try again
        nameToCheck = `${baseSaveName} (${counter})`;
        counter++;

        // Safety break to prevent infinite loops in edge cases
        if (counter > 100) {
            throw new Error("Не удалось сгенерировать уникальное имя после 100 попыток.");
        }
      }

      // Создаем соль на основе *финального* имени
      const salt = saveName;

      // Генерируем ключ из мастер-пароля
      const key = CryptoJS.PBKDF2(master, salt, {
        keySize: 256 / 32,
        iterations: 1000 // Consider increasing iterations for better security
      });

      // Шифруем настройки
      const encryptedData = CryptoJS.AES.encrypt(
        JSON.stringify(settings),
        key.toString()
      ).toString();

      // Отправляем на сервер
      const saveResponse = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName, // Send the final unique name
          encryptedData: encryptedData
        })
      });

      const saveData = await saveResponse.json();

      if (saveData.success) {
        log(`Настройки сохранены как "${saveName}"`, true);
        // Перенаправляем на главную страницу через 2 секунды
        // Make sure the /saved page exists or redirect to "/"
        setTimeout(() => {
          router.push("/saved"); // Redirect to the list of saved passwords
        }, 2000);
      } else {
        throw new Error(saveData.error || "Не удалось сохранить настройки");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      log(`Ошибка при сохранении: ${err.message}`); // Show error in status
      // alert(`Ошибка при сохранении: ${err.message}`); // Keep alert for critical errors
    }
  };


  // Return statement using the new JSX structure
  return (
    <>
      <Head>
        {/* Changed title to reflect the component's purpose */}
        <title>Генератор паролей (Argon2)</title>
        <link rel="stylesheet" href="/styles.css" />
      </Head>
      <div className="container">
        <div className="card">
          <div className="header">
            {/* Back button might be useful if this page is accessed from elsewhere */}
            {/* If it's the main page, this button might not be needed */}
            <button
              className="back-btn"
              onClick={() => router.push("/")} // Assuming '/' is the main or previous page
            >
              ← На главную
            </button>
             {/* Keep the original title */}
            <h1>Генератор паролей</h1>
          </div>

          <div className="form-group">
            <label htmlFor="master">Мастер-фраза</label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="master"
                placeholder="Введите секретную фразу"
              />
              <button
                type="button" // Prevent form submission if inside a form
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {/* Use text or more common icons for better accessibility/understanding */}
                {showPassword ? "Скрыть" : "Показать"}
                {/* Alternative icons: {showPassword ? "👁️" : "👁️‍🗨️"} */}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="service">Сервис</label>
            <input type="text" id="service" placeholder="Например: google.com" />
          </div>

          <div className="row">
            <div className="col">
              <div className="form-group">
                <label htmlFor="account">Аккаунт</label>
                <input type="text" id="account" defaultValue="default" placeholder="Например: user@example.com"/>
              </div>
            </div>
            <div className="col">
              <div className="form-group">
                <label htmlFor="device">Устройство</label>
                <input type="text" id="device" defaultValue="default" placeholder="Например: рабочий ПК"/>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col">
              <div className="form-group">
                <label htmlFor="version">Версия</label>
                <input type="text" id="version" defaultValue="00" maxLength={2} pattern="\d{2}" placeholder="00" title="Введите 2 цифры"/>
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
              <label htmlFor="uppercase">A-Z</label> {/* More descriptive label */}
            </div>
            <div className="checkbox-item">
              <input type="checkbox" id="lowercase" defaultChecked />
              <label htmlFor="lowercase">a-z</label> {/* More descriptive label */}
            </div>
            <div className="checkbox-item">
              <input type="checkbox" id="digits" defaultChecked />
              <label htmlFor="digits">0-9</label> {/* More descriptive label */}
            </div>
            <div className="checkbox-item">
              <input type="checkbox" id="symbols" defaultChecked />
              <label htmlFor="symbols">!@#</label> {/* More descriptive label */}
            </div>
          </div>

          {/* Changed button layout */}
          <div className="button-row">
            <button
              className="reset-btn"
              onClick={resetSettings}
              type="button" // Good practice for buttons not submitting forms
            >
              Сбросить
            </button>
            <button
              className="generate"
              id="generateBtn"
              onClick={generatePassword}
              disabled={isLoading}
              type="button"
            >
              {isLoading ? "ЗАГРУЗКА..." : "СГЕНЕРИРОВАТЬ"} {/* Update text when loading */}
            </button>
          </div>


          <div className="result-container">
            <input type="text" id="result" readOnly placeholder="Пароль будет здесь" />
            <button className="copy-btn" onClick={() => copyToClipboard('result')} aria-label="Копировать пароль">⧉</button>
          </div>

          {/* Modified button group for Save and View */}
          <div className="button-group">
            <button
              className="save-btn"
              onClick={saveSettings} // Uses the modified saveSettings
              disabled={isLoading} // Disable while loading Argon
              type="button"
            >
              Сохранить настройки
            </button>
            <button
              className="view-saved-btn"
              onClick={() => router.push("/saved")} // Ensure this route exists
              type="button"
            >
              Сохраненные пароли
            </button>
          </div>
        </div> {/* End card */}

        <div className="status" id="status">
          {error ? `Ошибка: ${error}` : isLoading ? "Инициализация Argon2..." : "Готово к работе"}
        </div>

        {/* Removed the save modal section */}

      </div> {/* End container */}
    </>
  );
}

// Вспомогательные функции (Helper functions)

function log(msg, isSuccess = false) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = msg;
    // Add distinct classes for error/success/info
    statusEl.className = isSuccess ? 'status success' : 'status info'; // Assume default is 'info'

    // Clear message after a delay only for success messages
    if (isSuccess) {
      setTimeout(() => {
        // Reset to default message or clear
        // statusEl.textContent = "Готово к работе"; // Or keep the success message longer if needed
        statusEl.className = 'status'; // Remove success class
      }, 3000); // Increased delay
    }
  } else {
    console.log(`Status (${isSuccess ? 'Success' : 'Info'}): ${msg}`); // Fallback logging
  }
}

function getCharset() {
  let chars = '';
  // Use more robust characters, avoiding ambiguous ones like I, l, 1, O, 0
  if (document.getElementById('lowercase').checked) chars += 'abcdefghijkmnpqrstuvwxyz';
  if (document.getElementById('uppercase').checked) chars += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  if (document.getElementById('digits').checked) chars += '23456789';
  // Consider allowing customization or defining a standard set
  if (document.getElementById('symbols').checked) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  return chars;
}

function hashToPassword(hash, length, charset) {
    if (!charset || charset.length === 0) {
        log("Ошибка: Набор символов пуст.");
        return ""; // Return empty string or handle error appropriately
    }
  // Ensure length is within reasonable bounds
  const safeLength = Math.max(6, Math.min(length, 64));
  // Generate password using the hash bytes
  return Array.from(hash)
    .slice(0, safeLength) // Use the safe length
    .map(byte => charset[byte % charset.length]) // Map byte to character
    .join('');
}

function stringToBytes(str) {
  // Ensure UTF-8 encoding
  return new TextEncoder().encode(str);
}

function getSettings() {
  // Helper to safely get element value or default
  const getValue = (id, defaultValue = "") => document.getElementById(id)?.value ?? defaultValue;
  const getChecked = (id, defaultChecked = false) => document.getElementById(id)?.checked ?? defaultChecked;

  return {
    service: getValue("service").trim(),
    account: getValue("account", "default").trim(),
    device: getValue("device", "default").trim(),
    version: getValue("version", "00").trim(),
    length: parseInt(getValue("length", "16"), 10) || 16, // Ensure integer conversion
    lowercase: getChecked("lowercase", true),
    uppercase: getChecked("uppercase", true),
    digits: getChecked("digits", true),
    symbols: getChecked("symbols", true)
  };
}

function applySettings(obj) {
   // Helper to safely set element value
   const setValue = (id, value) => {
       const el = document.getElementById(id);
       if (el) el.value = value;
   };
   const setChecked = (id, checked) => {
       const el = document.getElementById(id);
       if (el) el.checked = checked;
   };

   setValue("service", obj.service || "");
   setValue("account", obj.account || "default");
   setValue("device", obj.device || "default");
   setValue("version", obj.version || "00");
   setValue("length", obj.length || 16);
   setChecked("lowercase", obj.lowercase ?? true);
   setChecked("uppercase", obj.uppercase ?? true);
   setChecked("digits", obj.digits ?? true);
   setChecked("symbols", obj.symbols ?? true);
}

// Removed copySettings and pasteSettings as they seem unused in the new flow
/*
function copySettings() { ... }
function pasteSettings() { ... }
*/

function copyToClipboard(id) {
  const el = document.getElementById(id);
  if (!el || !el.value) {
    log("Нечего копировать");
    return;
  }
  try {
    el.select(); // Select the text field content
    // Modern async clipboard API with fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(el.value).then(() => {
            log("Пароль скопирован в буфер обмена", true);
        }).catch(err => {
            console.error('Async: Could not copy text: ', err);
            // Fallback to execCommand
            if(!document.execCommand("copy")) {
                log("Ошибка копирования");
            } else {
                log("Пароль скопирован (fallback)", true);
            }
        });
    } else {
        // Fallback for older browsers
        if(!document.execCommand("copy")) {
            log("Ошибка копирования");
        } else {
            log("Пароль скопирован (fallback)", true);
        }
    }
  } catch (err) {
      console.error("Error copying to clipboard:", err);
      log("Ошибка при копировании");
  }

  // Deselect text after copying
  if (window.getSelection) {
    window.getSelection().removeAllRanges();
  } else if (document.selection) {
    document.selection.empty();
  }
}

function generatePassword() {
  if (!window.Module?.isReady) {
    log("Модуль Argon2 ещё не готов. Пожалуйста, подождите.");
    return;
  }

  const master = document.getElementById("master")?.value?.trim();
  const service = document.getElementById("service")?.value?.trim();

  if (!master || !service) {
    alert("Пожалуйста, заполните Мастер-фразу и Сервис.");
    return;
  }

  const account = document.getElementById("account")?.value || "default";
  const device = document.getElementById("device")?.value || "default";
  const version = document.getElementById("version")?.value || "00";

  // Construct the salt string consistently
  const salt = `${service}:${account}:${device}:${version}`;

  const charset = getCharset();
  const length = parseInt(document.getElementById("length")?.value, 10) || 16;

  if (charset.length < 4) { // Check if at least one checkbox is checked effectively
    alert("Выберите хотя бы один тип символов для пароля.");
    return;
  }
  if (length < 6 || length > 64) {
    alert("Длина пароля должна быть между 6 и 64 символами.");
    return;
  }

  log("Генерация пароля...");
  // Disable button during generation
  const genBtn = document.getElementById('generateBtn');
  if(genBtn) genBtn.disabled = true;


  // Use setTimeout to allow the UI to update ("Генерация пароля...") before blocking
  setTimeout(() => {
      try {
        let mod = window.Module;
        let pwdBytes = stringToBytes(master);
        let saltBytes = stringToBytes(salt);

        // Allocate memory using Module._malloc
        let pwdPtr = mod._malloc(pwdBytes.length);
        let saltPtr = mod._malloc(saltBytes.length);
        let hashPtr = mod._malloc(32); // Argon2 output hash length (32 bytes for Argon2id)
        // let encodedPtr = mod._malloc(512); // Buffer for encoded hash string (not strictly needed if only using raw hash)

        // Write data to WASM memory
        mod.HEAPU8.set(pwdBytes, pwdPtr);
        mod.HEAPU8.set(saltBytes, saltPtr);

        // Argon2 parameters (adjust as needed for security/performance balance)
        const t_cost = 3;     // Iterations
        const m_cost = 65536; // Memory cost in KiB (64 MiB)
        const parallelism = 1;// Parallelism factor
        const hashLen = 32;   // Output hash length in bytes
        const type = 2;       // 0=Argon2d, 1=Argon2i, 2=Argon2id
        const versionNum = 0x13; // Argon2 version (0x13 = 1.3)

        // Call Argon2 hash function
        const result = mod.ccall(
            'argon2_hash', 'number',
            ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
            [t_cost, m_cost, parallelism,
            pwdPtr, pwdBytes.length,
            saltPtr, saltBytes.length,
            hashPtr, hashLen,
            null, 0, // No encoded string needed here
            type, versionNum]
        );

        if (result !== 0) {
          // Try to get error message if available
          let error_msg = "Неизвестная ошибка Argon2";
          try {
              const errorMessagePtr = mod.ccall('argon2_error_message', 'number', ['number'], [result]);
              if (errorMessagePtr) {
                  error_msg = mod.UTF8ToString(errorMessagePtr);
              }
          } catch (e) { console.error("Could not get Argon2 error message", e); }
          log(`Ошибка генерации Argon2: ${error_msg} (код ${result})`);
          throw new Error(`Argon2 hashing failed with code ${result}`);
        }

        // Read the raw hash result from WASM memory
        const hash = new Uint8Array(mod.HEAPU8.buffer, hashPtr, hashLen);

        // Convert raw hash to the final password string
        const password = hashToPassword(hash, length, charset);

        // Display the result
        const resultEl = document.getElementById("result");
        if(resultEl) resultEl.value = password;
        log("Пароль успешно сгенерирован", true);

        // Free allocated memory
        mod._free(pwdPtr);
        mod._free(saltPtr);
        mod._free(hashPtr);
        // mod._free(encodedPtr); // Free if it was allocated

      } catch (e) {
        console.error("Error during password generation:", e);
        log("Критическая ошибка при генерации пароля: " + e.message);
      } finally {
          // Re-enable button regardless of outcome
          if(genBtn) genBtn.disabled = false;
      }
  }, 50); // Small delay
}

// Добавляем функцию для сброса настроек
const resetSettings = () => {
  try {
      document.getElementById("service").value = "";
      document.getElementById("account").value = "default";
      document.getElementById("device").value = "default";
      document.getElementById("version").value = "00";
      document.getElementById("length").value = "16";
      document.getElementById("lowercase").checked = true;
      document.getElementById("uppercase").checked = true;
      document.getElementById("digits").checked = true;
      document.getElementById("symbols").checked = true;
      document.getElementById("master").value = "";
      document.getElementById("result").value = "";
      // Reset show password state if needed (requires passing setShowPassword or managing state differently)
      // For now, just clears the field. The state remains as is.
      log("Форма сброшена");
  } catch (e) {
      console.error("Error resetting form:", e);
      log("Ошибка при сбросе формы");
  }
};