import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import CryptoJS from "crypto-js";

export default function SavedPasswords() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false); // Этот стейт теперь управляет новым модальным окном
  const [showGeneratedPasswordModal, setShowGeneratedPasswordModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchEntries();
  }, []);

  // --- Функции fetchEntries, handleDelete, handleUseEntry остаются без изменений ---

  const fetchEntries = async () => {
    try {
      const response = await fetch("/api/entries");
      const data = await response.json();

      if (data.entries) {
        setEntries(data.entries);
      }
    } catch (err) {
      setError("Ошибка при загрузке сохраненных паролей");
      console.error("Error fetching entries:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entryId) => {
    if (confirm("Вы уверены, что хотите удалить этот пароль?")) {
      try {
        const response = await fetch(`/api/entries?id=${entryId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          fetchEntries();
        } else {
          setError("Ошибка при удалении пароля");
        }
      } catch (err) {
        setError("Ошибка при удалении пароля");
        console.error("Error deleting entry:", err);
      }
    }
  };

  const handleUseEntry = (entry) => {
    setSelectedEntry(entry);
    setMasterPassword(""); // Очищаем поле пароля при открытии
    setShowPassword(false); // Скрываем пароль по умолчанию
    setShowPasswordModal(true); // Показываем новое модальное окно
  };

  // Эта функция вызывается кнопкой "Пароль" на элементе списка
  const generatePasswordForEntry = (entry) => {
    setSelectedEntry(entry);
    setMasterPassword(""); // Очищаем поле пароля при открытии
    setShowPassword(false); // Скрываем пароль по умолчанию
    setShowPasswordModal(true); // Показываем новое модальное окно
  };

  // --- Функция loadArgon2Module остается без изменений ---
  const loadArgon2Module = () => {
    return new Promise((resolve, reject) => {
      if (window.Module?.isReady) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "/argon2.js";
      script.async = true;

      script.onload = () => {
        if (!window.Module) {
          reject(new Error("window.Module не определён"));
          return;
        }

        window.Module.onRuntimeInitialized = () => {
          window.Module.isReady = true;
          resolve();
        };
      };

      script.onerror = () => {
        reject(new Error("Ошибка загрузки скрипта argon2.js"));
      };

      document.body.appendChild(script);
    });
  };

  // Модифицированная функция decryptAndUse
  const decryptAndUse = async (redirect = false) => { // По умолчанию false (показать пароль)
    if (!masterPassword) {
      alert("Пожалуйста, введите мастер-пароль");
      return;
    }
    if (!selectedEntry) {
        console.error("Нет выбранной записи для расшифровки.");
        alert("Произошла ошибка: запись не выбрана.");
        return;
    }

    try {
      const salt = selectedEntry.name; // Используем имя как соль для шифрования настроек
      const key = CryptoJS.PBKDF2(masterPassword, salt, {
        keySize: 256 / 32,
        iterations: 1000
      });

      const bytes = CryptoJS.AES.decrypt(selectedEntry.encryptedData, key.toString());
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedString) {
          throw new Error("Не удалось расшифровать данные. Возможно, неверный мастер-пароль.");
      }
      const decryptedSettings = JSON.parse(decryptedString);

      // Закрываем модальное окно ввода пароля *перед* выполнением действия
      setShowPasswordModal(false);

      if (redirect) {
        // Переход на редактор
        localStorage.setItem("passwordSettings", JSON.stringify(decryptedSettings));
        localStorage.setItem("editingEntryId", selectedEntry._id); // Сохраняем ID для редактирования
        localStorage.setItem("editingEntryName", selectedEntry.name); // Сохраняем имя для редактирования
        router.push("/editor");
      } else {
        // Генерация пароля без перехода
        setLoading(true); // Показываем индикатор загрузки на время генерации
        if (!window.Module || !window.Module.isReady) {
          try {
            await loadArgon2Module();
          } catch (loadErr) {
             setError("Ошибка загрузки модуля Argon2.");
             console.error("Argon2 load error:", loadErr);
             setLoading(false);
             // Не очищаем пароль здесь, чтобы пользователь мог попробовать еще раз
             setShowPasswordModal(true); // Снова показываем окно ввода пароля
             return;
          }
        }

        const master = masterPassword;
        const service = decryptedSettings.service;
        const account = decryptedSettings.account || "default";
        const device = decryptedSettings.device || "default";
        const version = decryptedSettings.version || "00";

        const argonSalt = service + ":" + account + ":" + device + ":" + version;

        const getCharset = () => {
          let chars = '';
          if (decryptedSettings.lowercase) chars += 'abcdefghijkmnpqrstuvwxyz';
          if (decryptedSettings.uppercase) chars += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
          if (decryptedSettings.digits) chars += '23456789';
          if (decryptedSettings.symbols) chars += '!@#$%&';
          return chars || 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&'; // Фоллбэк
        };

        const stringToBytes = (str) => new TextEncoder().encode(str);
        const hashToPassword = (hash, length, charset) =>
          Array.from(hash).slice(0, length).map(b => charset[b % charset.length]).join('');

        const charset = getCharset();
        const length = parseInt(decryptedSettings.length) || 16;

        let mod = window.Module;
        let pwdBytes = stringToBytes(master);
        let saltBytes = stringToBytes(argonSalt); // Используем argonSalt
        let pwdPtr = 0, saltPtr = 0, hashPtr = 0, encodedPtr = 0;

        try {
            pwdPtr = mod._malloc(pwdBytes.length);
            saltPtr = mod._malloc(saltBytes.length);
            hashPtr = mod._malloc(32); // Argon2 output size
            encodedPtr = mod._malloc(512); // Buffer for encoded hash string (optional)

            new Uint8Array(mod.HEAPU8.buffer, pwdPtr, pwdBytes.length).set(pwdBytes);
            new Uint8Array(mod.HEAPU8.buffer, saltPtr, saltBytes.length).set(saltBytes);

            const result = mod._argon2_hash(
              3, // t_cost (iterations)
              65536, // m_cost (memory in KiB)
              1, // parallelism
              pwdPtr, pwdBytes.length,
              saltPtr, saltBytes.length,
              hashPtr, 32,       // Raw hash output
              encodedPtr, 512, // Encoded string output (not strictly needed here)
              2, // Argon2id
              0x13 // Argon2 version 1.3
            );

            if (result !== 0) {
              throw new Error("Ошибка генерации Argon2 хеша: код " + result);
            }

            const hash = new Uint8Array(mod.HEAPU8.buffer.slice(hashPtr, hashPtr + 32)); // Копируем хеш
            const password = hashToPassword(hash, length, charset);

            setGeneratedPassword(password);
            setShowGeneratedPasswordModal(true); // Показываем модальное окно с паролем

        } finally {
            // Освобождаем память C++
            if(pwdPtr) mod._free(pwdPtr);
            if(saltPtr) mod._free(saltPtr);
            if(hashPtr) mod._free(hashPtr);
            if(encodedPtr) mod._free(encodedPtr);
            setLoading(false); // Скрываем индикатор загрузки
        }
      }

      // Очищаем мастер-пароль после успешной операции
      setMasterPassword("");

    } catch (err) {
      alert("Неверный мастер-пароль или ошибка данных: " + err.message);
      console.error("Error decrypting/generating:", err);
      // Не очищаем пароль при ошибке, чтобы пользователь мог попробовать снова
       // Если окно уже было закрыто, снова его покажем
       if (!redirect) {
           setShowPasswordModal(true);
       }
    } finally {
       setLoading(false); // Убедимся, что индикатор скрыт
    }
  };

  // --- Группировка и фильтрация остаются без изменений ---
  const groupedEntries = entries.reduce((groups, entry) => {
    let serviceName = entry.name; // Используем имя записи как ключ группы
    if (!groups[serviceName]) {
      groups[serviceName] = [];
    }
    groups[serviceName].push(entry);
    return groups;
  }, {});

  const filteredGroups = Object.keys(groupedEntries)
    .filter(service => service.toLowerCase().includes(searchTerm.toLowerCase()))
    .reduce((obj, key) => {
      obj[key] = groupedEntries[key];
      return obj;
    }, {});

  if (loading) return <div className="container"><p>Загрузка...</p></div>; // Изменено сообщение

  return (
    <>
      <Head>
        <title>Менеджер паролей</title>
        <link rel="stylesheet" href="/styles.css" />
      </Head>
      <div className="container">
        <div className="card">
          <h1>Мои пароли</h1>

          {error && <div className="error-message">{error}</div>}

          <div className="search-container">
            <input
              type="text"
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {entries.length === 0 ? (
            <p>У вас пока нет сохраненных паролей</p>
          ) : (
            <div className="entries-list">
              {Object.keys(filteredGroups).sort((a, b) => a.localeCompare(b)).map(service => ( // Сортировка по имени сервиса
                // Используем имя записи как ключ группы и заголовок
                <div key={service} className="entry-group">
                  {/* <div className="service-name">{service}</div> */} {/* Можно убрать, если имя записи = имя сервиса */}
                  {filteredGroups[service].map(entry => (
                    <div key={entry._id} className="entry-item">
                      <div className="entry-info">
                        <div className="entry-name">{entry.name}</div>
                      </div>
                      <div className="entry-actions">
                        <button
                          className="action-btn password-btn"
                          onClick={() => generatePasswordForEntry(entry)}
                          title="Получить пароль"
                        >
                          Пароль
                        </button>
                        <button
                          className="action-btn edit-btn"
                          onClick={() => handleUseEntry(entry)} // Теперь эта кнопка тоже открывает окно ввода пароля
                          title="Редактировать параметры"
                        >
                          Редактировать
                        </button>
                        <button
                          className="action-btn delete-btn"
                          onClick={() => handleDelete(entry._id)}
                          title="Удалить"
                        >
                          <span className="trash-icon">🗑️</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          className="fab-button"
          onClick={() => {
             localStorage.removeItem("passwordSettings"); // Очищаем настройки перед созданием новой записи
             localStorage.removeItem("editingEntryId");
             localStorage.removeItem("editingEntryName");
             router.push("/editor");
            }}
        >
          +
        </button>

        {/* === НАЧАЛО: Измененное Модальное окно для ввода мастер-пароля === */}
        {showPasswordModal && selectedEntry && ( // Добавлена проверка selectedEntry
          <div className="modal-overlay">
            <div className="modal-content master-password-modal"> {/* Добавлен класс master-password-modal */}
              <button
                className="modal-close-btn"
                onClick={() => {
                  setShowPasswordModal(false);
                  setMasterPassword(""); // Очищаем пароль при закрытии
                }}
                aria-label="Закрыть" // Для доступности
              >
                × {/* HTML entity for 'X' */}
              </button>

              {/* Заголовок и текст удалены */}

              <div className="form-group password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Мастер-пароль"
                  // Добавляем обработчик нажатия Enter
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // По Enter пытаемся получить пароль (не редактировать)
                      decryptAndUse(false);
                    }
                  }}
                  autoFocus // Автофокус на поле ввода при открытии
                />
                <button
                  type="button" // Важно для предотвращения отправки формы, если она есть
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} // Для доступности
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>

              <div className="modal-actions">
                {/* Кнопка "Отмена" удалена */}
                <button
                  className="confirm-btn password-action-btn" // Добавлен класс password-action-btn
                  onClick={() => decryptAndUse(false)} // false -> показать пароль
                  disabled={loading} // Блокируем кнопку во время загрузки
                >
                  {loading ? 'Генерация...' : 'Пароль'}
                </button>
                <button
                  className="edit-btn password-action-btn" // Добавлен класс password-action-btn
                  onClick={() => decryptAndUse(true)} // true -> редактировать
                  disabled={loading} // Блокируем кнопку во время загрузки
                >
                  Редактировать
                </button>
              </div>
            </div>
          </div>
        )}
        {/* === КОНЕЦ: Измененное Модальное окно для ввода мастер-пароля === */}


        {/* Модальное окно для отображения сгенерированного пароля (без изменений) */}
        {showGeneratedPasswordModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Ваш пароль</h2>

              <div className="password-result-container">
                <input
                  type="text"
                  readOnly
                  value={generatedPassword}
                  className="password-result"
                  id="generatedPasswordInput" // Добавим ID для легкого доступа
                />
                <button
                  className="copy-btn"
                  onClick={() => {
                    const passwordInput = document.getElementById('generatedPasswordInput');
                    passwordInput.select(); // Выделяем текст для мобильных устройств
                    navigator.clipboard.writeText(generatedPassword).then(() => {
                      alert("Пароль скопирован в буфер обмена");
                    }).catch(err => {
                      console.error('Ошибка копирования:', err);
                      alert('Не удалось скопировать пароль.');
                    });
                  }}
                  aria-label="Скопировать пароль" // Для доступности
                >
                  ⧉
                </button>
              </div>

              <div className="modal-actions">
                <button className="confirm-btn" onClick={() => {
                  setShowGeneratedPasswordModal(false);
                  setGeneratedPassword(""); // Очищаем сгенерированный пароль
                }}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}