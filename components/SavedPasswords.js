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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
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

  const decryptAndUse = async () => {
    if (!masterPassword) {
      alert("Пожалуйста, введите мастер-пароль");
      return;
    }

    try {
      // Создаем соль на основе имени записи (как указано в документации)
      const salt = selectedEntry.name;
      
      // Используем мастер-пароль для расшифровки данных
      const key = CryptoJS.PBKDF2(masterPassword, salt, {
        keySize: 256 / 32,
        iterations: 1000
      });
      
      // Расшифровываем данные
      const bytes = CryptoJS.AES.decrypt(selectedEntry.encryptedData, key.toString());
      const decryptedSettings = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      
      // Передаем расшифрованные настройки в LocalStorage для использования в генераторе
      localStorage.setItem("passwordSettings", JSON.stringify(decryptedSettings));
      
      // Переходим на страницу генератора
      router.push("/");
      
      // Закрываем модальное окно
      setShowPasswordModal(false);
      setMasterPassword("");
    } catch (err) {
      alert("Неверный мастер-пароль или поврежденные данные");
      console.error("Error decrypting:", err);
    }
  };

  if (loading) return <div className="container"><p>Загрузка сохраненных паролей...</p></div>;

  return (
    <>
      <Head>
        <title>Сохраненные пароли</title>
        <link rel="stylesheet" href="/styles.css" />
      </Head>
      <div className="container">
        <div className="card">
          <h1>Сохраненные пароли</h1>
          
          {error && <div className="error-message">{error}</div>}
          
          {entries.length === 0 ? (
            <p>У вас пока нет сохраненных паролей</p>
          ) : (
            <div className="entries-list">
              {entries.map(entry => (
                <div key={entry._id} className="entry-item">
                  <div className="entry-name">{entry.name}</div>
                  <div className="entry-actions">
                    <button 
                      className="action-btn use-btn" 
                      onClick={() => handleUseEntry(entry)}
                    >
                      Использовать
                    </button>
                    <button 
                      className="action-btn delete-btn" 
                      onClick={() => handleDelete(entry._id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button 
            className="generate" 
            onClick={() => router.push("/")}
          >
            СОЗДАТЬ НОВЫЙ ПАРОЛЬ
          </button>
        </div>
        
        {showPasswordModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Введите мастер-пароль</h2>
              <p>Для расшифровки параметров "{selectedEntry.name}" введите мастер-пароль:</p>
              
              <div className="form-group">
                <input 
                  type="password" 
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Мастер-пароль"
                />
              </div>
              
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => {
                  setShowPasswordModal(false);
                  setMasterPassword("");
                }}>
                  Отмена
                </button>
                <button className="confirm-btn" onClick={decryptAndUse}>
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}