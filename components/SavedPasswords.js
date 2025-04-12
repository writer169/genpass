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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showGeneratedPasswordModal, setShowGeneratedPasswordModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchEntries();
  }, []);

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
          // Обновляем список после удаления
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
    setShowPasswordModal(true);
  };

  // Добавьте функцию для генерации пароля
  const generatePasswordForEntry = async (entry) => {
    setSelectedEntry(entry);
    setShowPasswordModal(true);
  };

  // Модифицируем функцию decryptAndUse
  const decryptAndUse = async (redirect = true) => {
    if (!masterPassword) {
      alert("Пожалуйста, введите мастер-пароль");
      return;
    }

    try {
      const salt = selectedEntry.name;
      const key = CryptoJS.PBKDF2(masterPassword, salt, {
        keySize: 256 / 32,
        iterations: 1000
      });
      
      const bytes = CryptoJS.AES.decrypt(selectedEntry.encryptedData, key.toString());
      const decryptedSettings = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      
      if (redirect) {
        // Переход на редактор
        localStorage.setItem("passwordSettings", JSON.stringify(decryptedSettings));
        router.push("/editor");
      } else {
        // Генерация пароля без перехода
        if (!window.Module || !window.Module.isReady) {
          // Загрузка Argon2 если еще не загружен
          await loadArgon2Module();
        }
        
        const master = masterPassword;
        const service = decryptedSettings.service;
        const account = decryptedSettings.account || "default";
        const device = decryptedSettings.device || "default";
        const version = decryptedSettings.version || "00";
        
        const salt = service + ":" + account + ":" + device + ":" + version;
        
        // Функции для работы с Argon2 (скопированы из Generator.js)
        const getCharset = () => {
          let chars = '';
          if (decryptedSettings.lowercase) chars += 'abcdefghijkmnpqrstuvwxyz';
          if (decryptedSettings.uppercase) chars += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
          if (decryptedSettings.digits) chars += '23456789';
          if (decryptedSettings.symbols) chars += '!@#$%&';
          return chars;
        };
        
        const stringToBytes = (str) => new TextEncoder().encode(str);
        const hashToPassword = (hash, length, charset) => 
          Array.from(hash).slice(0, length).map(b => charset[b % charset.length]).join('');
        
        const charset = getCharset();
        const length = parseInt(decryptedSettings.length) || 16;
        
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
          throw new Error("Ошибка генерации: " + result);
        }

        const hash = new Uint8Array(mod.HEAPU8.buffer, hashPtr, 32);
        const password = hashToPassword(hash, length, charset);
        
        // Отображаем результат
        setGeneratedPassword(password);
        setShowGeneratedPasswordModal(true);
        setShowPasswordModal(false);
        
        // Освобождаем память
        mod._free(pwdPtr);
        mod._free(saltPtr);
        mod._free(hashPtr);
        mod._free(encodedPtr);
      }
      
      // В любом случае очищаем пароль
      setMasterPassword("");
    } catch (err) {
      alert("Неверный мастер-пароль или поврежденные данные");
      console.error("Error decrypting:", err);
    }
  };

  // Функция для загрузки модуля Argon2
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

  // Группировка паролей по сервису
  const groupedEntries = entries.reduce((groups, entry) => {
    // Попытаемся извлечь имя сервиса из имени записи
    let serviceName = entry.name;
    
    // Проверяем, есть ли вообще группа для этого сервиса
    if (!groups[serviceName]) {
      groups[serviceName] = [];
    }
    
    groups[serviceName].push(entry);
    return groups;
  }, {});

  // Фильтрация по поисковому запросу
  const filteredGroups = Object.keys(groupedEntries)
    .filter(service => service.toLowerCase().includes(searchTerm.toLowerCase()))
    .reduce((obj, key) => {
      obj[key] = groupedEntries[key];
      return obj;
    }, {});

  if (loading) return <div className="container"><p>Загрузка сохраненных паролей...</p></div>;

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
              {Object.keys(filteredGroups).map(service => (
                <div key={service} className="entry-group">
                  <div className="service-name">{service}</div>
                  {filteredGroups[service].map(entry => (
                    <div key={entry._id} className="entry-item">
                      <div className="entry-info">
                        <div className="entry-name">{entry.name}</div>
                        {/* Здесь мы можем показать дополнительную информацию, но она зашифрована */}
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
                          onClick={() => handleUseEntry(entry)}
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
          onClick={() => router.push("/editor")}
        >
          +
        </button>
        
        {/* Модальное окно для ввода мастер-пароля */}
        {showPasswordModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Введите мастер-пароль</h2>
              <p>Для получения пароля для "{selectedEntry.name}" введите мастер-пароль:</p>
              
              <div className="form-group password-input-container">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Мастер-пароль"
                />
                <button 
                  className="toggle-password-btn" 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => {
                  setShowPasswordModal(false);
                  setMasterPassword("");
                }}>
                  Отмена
                </button>
                <button className="confirm-btn" onClick={() => decryptAndUse(false)}>
                  Показать пароль
                </button>
                <button className="edit-btn" onClick={() => decryptAndUse(true)}>
                  Редактировать
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Модальное окно для отображения сгенерированного пароля */}
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
                />
                <button 
                  className="copy-btn" 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPassword);
                    // Показываем всплывающее сообщение об успешном копировании
                    alert("Пароль скопирован в буфер обмена");
                  }}
                >
                  ⧉
                </button>
              </div>
              
              <div className="modal-actions">
                <button className="confirm-btn" onClick={() => {
                  setShowGeneratedPasswordModal(false);
                  setGeneratedPassword("");
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
