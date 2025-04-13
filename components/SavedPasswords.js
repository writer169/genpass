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
  const [expandedServices, setExpandedServices] = useState({});
  const router = useRouter();

  useEffect(() => {
    fetchEntries();
    loadArgon2Module().catch(err => {
      console.error("Failed to load Argon2 module:", err);
      setError("Ошибка загрузки модуля Argon2");
    });
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/entries");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const fetchedEntries = data.entries || [];
      setEntries(fetchedEntries);
      
      // Инициализируем состояние всех сервисов развернутыми по умолчанию
      const services = {};
      fetchedEntries.forEach(entry => {
        const serviceName = extractServiceName(entry.name);
        services[serviceName] = true; // true = развернут
      });
      setExpandedServices(services);
    } catch (err) {
      setError("Ошибка при загрузке сохраненных паролей");
      console.error("Error fetching entries:", err);
      setEntries([]);
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

  const handleSelectEntry = (entry) => {
    setSelectedEntry(entry);
    setMasterPassword("");
    setShowPassword(false);
    setShowPasswordModal(true);
  };

  const toggleServiceExpand = (serviceName) => {
    setExpandedServices(prev => ({
      ...prev,
      [serviceName]: !prev[serviceName]
    }));
  };

  const decryptAndUse = async (redirect = true) => {
    if (!selectedEntry || !masterPassword) {
      alert("Пожалуйста, выберите запись и введите мастер-пароль");
      return;
    }

    try {
      const salt = selectedEntry.name;
      const key = CryptoJS.PBKDF2(masterPassword, salt, {
        keySize: 256 / 32,
        iterations: 1000
      });
      const bytes = CryptoJS.AES.decrypt(selectedEntry.encryptedData, key.toString());
      const decryptedSettingsString = bytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedSettingsString) {
        throw new Error("Decryption resulted in empty data. Check master password or data integrity.");
      }
      
      const decryptedSettings = JSON.parse(decryptedSettingsString);

      if (redirect) {
        localStorage.setItem("passwordSettings", JSON.stringify(decryptedSettings));
        closeMasterPasswordModal();
        router.push("/editor");
      } else {
        if (!window.Module || !window.Module.isReady) {
          await loadArgon2Module();
          if (!window.Module || !window.Module.isReady) {
            throw new Error("Argon2 module failed to initialize.");
          }
        }

        const master = masterPassword;
        const service = decryptedSettings.service;
        const account = decryptedSettings.account || "default";
        const device = decryptedSettings.device || "default";
        const version = decryptedSettings.version || "00";
        const saltArgon = service + ":" + account + ":" + device + ":" + version;

        const getCharset = () => {
          let chars = '';
          if (decryptedSettings.lowercase) chars += 'abcdefghijkmnpqrstuvwxyz';
          if (decryptedSettings.uppercase) chars += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
          if (decryptedSettings.digits) chars += '23456789';
          if (decryptedSettings.symbols) chars += '!@#$%&';
          return chars || 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&'; // Fallback
        };

        const stringToBytes = (str) => new TextEncoder().encode(str);
        const hashToPassword = (hash, length, charset) =>
          Array.from(hash).slice(0, length).map(b => charset[b % charset.length]).join('');

        const charset = getCharset();
        const length = parseInt(decryptedSettings.length) || 16;

        let mod = window.Module;
        let pwdBytes = stringToBytes(master);
        let saltBytes = stringToBytes(saltArgon);
        let pwdPtr = 0, saltPtr = 0, hashPtr = 0, encodedPtr = 0;

        try {
            pwdPtr = mod._malloc(pwdBytes.length);
            saltPtr = mod._malloc(saltBytes.length);
            hashPtr = mod._malloc(32);
            encodedPtr = mod._malloc(512);

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
                throw new Error("Ошибка генерации Argon2: " + result);
            }

            const hash = new Uint8Array(mod.HEAPU8.buffer, hashPtr, 32);
            const password = hashToPassword(hash, length, charset);

            setGeneratedPassword(password);
            setShowGeneratedPasswordModal(true);
            closeMasterPasswordModal(); // Close the master password modal

        } finally {
            // Ensure memory is freed even if errors occur
            if (pwdPtr && mod && mod._free) mod._free(pwdPtr);
            if (saltPtr && mod && mod._free) mod._free(saltPtr);
            if (hashPtr && mod && mod._free) mod._free(hashPtr);
            if (encodedPtr && mod && mod._free) mod._free(encodedPtr);
        }
      }
    } catch (err) {
      alert("Неверный мастер-пароль или ошибка при расшифровке/генерации.");
      console.error("Error decrypting/generating:", err);
      // Keep master password modal open for retry, but clear password field for security
      setMasterPassword("");
    }
  };

  const loadArgon2Module = () => {
    return new Promise((resolve, reject) => {
      if (window.Module?.isReady) {
        resolve();
        return;
      }
      if (document.querySelector('script[src="/argon2.js"]')) {
         // If script tag exists, maybe it's still loading or failed
         // Add a listener or timeout mechanism if needed, for now just wait shortly
         setTimeout(() => {
             if (window.Module?.isReady) resolve();
             // else reject(new Error("Argon2 module script exists but not ready.")); // Or retry logic
         }, 500);
         return;
      }

      const script = document.createElement("script");
      script.src = "/argon2.js";
      script.async = true;

      script.onload = () => {
        if (!window.Module) {
            console.error("argon2.js loaded but window.Module is not defined.");
            // Might need Module = {} before script load in some environments
             window.Module = window.Module || {}; // Ensure Module object exists
        }

         window.Module.onRuntimeInitialized = () => {
              console.log("Argon2 Runtime Initialized");
              window.Module.isReady = true;
              resolve();
          };
           // Fallback if onRuntimeInitialized is not called quickly
           setTimeout(() => {
               if (!window.Module.isReady) {
                   console.warn("onRuntimeInitialized not called, checking Module status.");
                   if (typeof window.Module._argon2_hash === 'function') {
                       console.log("Argon2 functions seem available, marking as ready.");
                       window.Module.isReady = true;
                       resolve();
                   } else {
                       reject(new Error("Argon2 runtime failed to initialize properly."));
                   }
               }
           }, 2000); // Adjust timeout as needed
      };

      script.onerror = (err) => {
        console.error("Script load error:", err);
        reject(new Error("Ошибка загрузки скрипта argon2.js"));
      };

      document.body.appendChild(script);
    });
  };
  
  // Функция для извлечения имени сервиса из полного имени записи
  const extractServiceName = (fullName) => {
    // Извлекаем первую часть имени до первого дефиса или возвращаем всё имя
    const parts = fullName.split(' - ');
    return parts[0] || fullName;
  };

  // Функция для извлечения отображаемого имени аккаунта без имени сервиса
  const getAccountName = (entry) => {
    const fullName = entry.name;
    const parts = fullName.split(' - ');
    
    // Если имя записи содержит разделитель " - "
    if (parts.length > 1) {
      return parts[1]; // Возвращаем часть после первого " - "
    }
    
    // Если разделителя нет, возвращаем пустую строку или значение по умолчанию
    return "Аккаунт";
  };

  // Группировка записей по имени сервиса
  const groupEntriesByService = () => {
    const groups = {};
    
    entries.forEach(entry => {
      const serviceName = extractServiceName(entry.name);
      if (!groups[serviceName]) {
        groups[serviceName] = [];
      }
      groups[serviceName].push(entry);
    });
    
    return groups;
  };

  // Фильтрация групп по поисковому запросу
  const getFilteredGroups = () => {
    const groups = groupEntriesByService();
    
    if (!searchTerm) return groups;
    
    const filteredGroups = {};
    Object.keys(groups).forEach(serviceName => {
      // Проверяем, содержит ли имя сервиса поисковый запрос
      if (serviceName.toLowerCase().includes(searchTerm.toLowerCase())) {
        filteredGroups[serviceName] = groups[serviceName];
        return;
      }
      
      // Проверяем каждую запись в группе
      const filteredEntries = groups[serviceName].filter(entry => 
        entry.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (filteredEntries.length > 0) {
        filteredGroups[serviceName] = filteredEntries;
      }
    });
    
    return filteredGroups;
  };

  const closeMasterPasswordModal = () => {
    setShowPasswordModal(false);
    setMasterPassword("");
    setShowPassword(false);
    setSelectedEntry(null); // Очистка выбранной записи при закрытии
  };

  const closeGeneratedPasswordModal = () => {
    setShowGeneratedPasswordModal(false);
    setGeneratedPassword("");
    // Сохраняем selectedEntry на случай, если пользователь захочет повторно сгенерировать или отредактировать
  };

  if (loading) return <div className="container"><p>Загрузка сохраненных паролей...</p></div>;

  const filteredGroups = getFilteredGroups();
  const serviceNames = Object.keys(filteredGroups).sort();

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

          {entries.length === 0 && !loading ? (
            <p>У вас пока нет сохраненных паролей</p>
          ) : serviceNames.length === 0 ? (
            <p>Ничего не найдено по запросу "{searchTerm}"</p>
          ) : (
            <div className="entries-list">
              {serviceNames.map(serviceName => (
                <div key={serviceName} className="service-group">
                  <div 
                    className="service-header" 
                    onClick={() => toggleServiceExpand(serviceName)}
                  >
                    <div className="service-name">
                      {serviceName}
                    </div>
                    <div className="service-expand-icon">
                      {expandedServices[serviceName] ? '▼' : '►'}
                    </div>
                  </div>
                  
                  {expandedServices[serviceName] && (
                    <div className="service-entries">
                      {filteredGroups[serviceName].map(entry => (
                        <div key={entry._id} className="account-entry">
                          <div 
                            className="account-name" 
                            onClick={() => handleSelectEntry(entry)}
                          >
                            {getAccountName(entry)}
                          </div>
                          <button
                            className="delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(entry._id);
                            }}
                            title="Удалить"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          className="fab-button"
          onClick={() => {
            localStorage.removeItem("passwordSettings"); // Очистка настроек для новой записи
            router.push("/editor");
          }}
        >
          +
        </button>

        {showPasswordModal && selectedEntry && (
          <div className="modal-overlay">
            <div className="modal-content">
              <button className="modal-close-btn" onClick={closeMasterPasswordModal}>
                ×
              </button>

              <div className="form-group password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Мастер-пароль"
                  className="master-password-input"
                  onKeyPress={(e) => { if (e.key === 'Enter') decryptAndUse(false); }}
                />
                <button
                  type="button"
                  className="toggle-password-btn-inline"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    {showPassword
                      ? <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-1.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0-6.5C6.48 7 2 11.82 2 12s4.48 5 10 5 10-4.82 10-5-4.48-5-10-5Zm0 8.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5Z"/>
                      : <path d="M12 7c-3.78 0-7.17 2.13-8.82 5.5C4.83 15.87 8.22 18 12 18s7.17-2.13 8.82-5.5C19.17 9.13 15.78 7 12 7Zm-9.14 4.25c.47-.8 1.09-1.5 1.82-2.06.4-.3.88-.53 1.4-.68-.33.59-.53 1.28-.53 2 0 .72.2 1.41.53 2-.52-.15-1-.38-1.4-.68-.73-.56-1.35-1.26-1.82-2.06C2.84 11.65 2.84 11.35 2.86 11.25Zm18.28 0c.02.1.02.4-.02.5-.47.8-1.09 1.5-1.82 2.06-.4.3-.88.53-1.4.68.33-.59.53-1.28.53-2 0-.72-.2-1.41-.53-2 .52.15 1 .38 1.4.68.73.56 1.35 1.26 1.82 2.06Zm-6.9 2.5c.33-.59.53-1.28.53-2s-.2-1.41-.53-2c1 .35 1.84 1.16 2.32 2.17-.48 1-1.32 1.82-2.32 2.17ZM8.32 11.25c-.48 1-1.32 1.82-2.32 2.17.33-.59.53-1.28.53-2s-.2-1.41-.53-2c1 .35 1.84 1.16 2.32 2.17Z"/>
                    }
                  </svg>
                </button>
              </div>

              <div className="modal-actions">
                <button className="confirm-btn" onClick={() => decryptAndUse(false)}>
                  Пароль
                </button>
                <button className="edit-btn" onClick={() => decryptAndUse(true)}>
                  Редактировать
                </button>
              </div>
            </div>
          </div>
        )}

        {showGeneratedPasswordModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <button className="modal-close-btn" onClick={closeGeneratedPasswordModal}>
                ×
              </button>
              <h2>Ваш пароль</h2>

              <div className="password-result-container">
                <input
                  type="text"
                  readOnly
                  value={generatedPassword}
                  className="password-result"
                />
                <button
                  className="copy-btn icon-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPassword);
                    alert("Пароль скопирован в буфер обмена");
                  }}
                  title="Копировать пароль"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1Zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 16H8V7h11v14Z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <style jsx>{`
        /* Стили для иерархического отображения паролей */
        .service-group {
          margin-bottom: 16px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          background: #fff;
        }
        
        .service-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background-color: #f5f5f5;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .service-header:hover {
          background-color: #e8e8e8;
        }
        
        .service-name {
          font-weight: 600;
          font-size: 16px;
        }
        
        .service-expand-icon {
          font-size: 14px;
          color: #666;
        }
        
        .service-entries {
          padding: 8px 0;
        }
        
        .account-entry {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px 8px 32px;
          border-bottom: 1px solid #f0f0f0;
          transition: background-color 0.2s;
        }
        
        .account-entry:last-child {
          border-bottom: none;
        }
        
        .account-entry:hover {
          background-color: #f9f9f9;
        }
        
        .account-name {
          cursor: pointer;
          flex-grow: 1;
        }
        
        .delete-btn {
          background: none;
          border: none;
          color: #ff5757;
          font-size: 18px;
          cursor: pointer;
          padding: 4px 8px;
          margin-left: 8px;
          border-radius: 50%;
          line-height: 1;
          transition: background-color 0.2s;
        }
        
        .delete-btn:hover {
          background-color: #ffe5e5;
        }
        
        /* Стили для модальных окон и других элементов интерфейса остаются без изменений */
      `}</style>
    </>
  );
}