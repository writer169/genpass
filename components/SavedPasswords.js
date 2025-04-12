// --- START OF FILE SavedPasswords.js ---

import { useState, useEffect, useMemo } from "react"; // Added useMemo
import Head from "next/head";
import { useRouter } from "next/router";
import CryptoJS from "crypto-js";
// Assuming you have a password generation utility
// import { generatePassword } from '../utils/passwordGenerator';

// Placeholder password generation function - REPLACE with your actual logic
const generatePasswordFromSettings = (settings) => {
  let charset = "";
  if (settings.useUppercase) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (settings.useLowercase) charset += "abcdefghijklmnopqrstuvwxyz";
  if (settings.useNumbers) charset += "0123456789";
  if (settings.useSymbols) charset += "!@#$%^&*()_+~`|}{[]:;?><,./-=";
  if (!charset) charset = "abcdefghijklmnopqrstuvwxyz"; // Fallback

  let password = "";
  const length = settings.length || 16; // Use saved length or default
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};


export default function SavedPasswords() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const router = useRouter();

  // --- New State Variables ---
  const [searchTerm, setSearchTerm] = useState("");
  const [showPassword, setShowPassword] = useState(false); // For modal password visibility
  const [showGeneratedPasswordModal, setShowGeneratedPasswordModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  // --- End New State Variables ---

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null); // Reset error on fetch
    try {
      const response = await fetch("/api/entries");
      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Assuming API returns { entries: [...] }
      // Ensure entries is always an array
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      setError("Ошибка при загрузке сохраненных паролей.");
      console.error("Error fetching entries:", err);
      setEntries([]); // Ensure entries is an empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entryId) => {
    if (confirm("Вы уверены, что хотите удалить эту запись?")) {
        setError(null);
      try {
        const response = await fetch(`/api/entries?id=${entryId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          // Обновляем список после удаления
          // setEntries(prevEntries => prevEntries.filter(entry => entry._id !== entryId)); // Faster UI update
          fetchEntries(); // Or refetch
        } else {
          const errorData = await response.json();
          setError(errorData.message || "Ошибка при удалении записи.");
        }
      } catch (err) {
        setError("Ошибка сети при удалении записи.");
        console.error("Error deleting entry:", err);
      }
    }
  };

  // Called by both "Пароль" and "Редактировать" buttons to open the master password modal
  const handleUseEntry = (entry) => {
    setSelectedEntry(entry);
    setShowPasswordModal(true);
    // Reset potentially leftover state
    setMasterPassword("");
    setShowPassword(false); // Reset password visibility toggle
    setGeneratedPassword(""); // Reset previous generated password
  };

  // Decrypts data, then either shows generated password or navigates to editor
  const decryptAndUse = async (isEditing = false) => {
    if (!masterPassword) {
      alert("Пожалуйста, введите мастер-пароль");
      return;
    }

    if (!selectedEntry) {
        console.error("No entry selected for decryption.");
        alert("Произошла ошибка: запись не выбрана.");
        return;
    }

    try {
      // Use entry name as salt (ensure consistency with saving logic)
      const salt = selectedEntry.name;
      const key = CryptoJS.PBKDF2(masterPassword, salt, {
        keySize: 256 / 32,
        iterations: 1000 // Make sure this matches the iterations used during encryption
      });

      const bytes = CryptoJS.AES.decrypt(selectedEntry.encryptedData, key.toString());
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

      // Check if decryption produced a valid string
      if (!decryptedString) {
          throw new Error("Decryption failed or resulted in empty data. Check master password or data integrity.");
      }

      const decryptedSettings = JSON.parse(decryptedString);

      // Close the master password modal FIRST
      setShowPasswordModal(false);
      setMasterPassword("");
      setShowPassword(false); // Reset visibility toggle

      if (isEditing) {
        // Store settings and essential info for the editor page
        localStorage.setItem("passwordSettingsToEdit", JSON.stringify({
            ...decryptedSettings,
            id: selectedEntry._id, // Pass ID for saving update
            name: selectedEntry.name, // Pass current name
            service: selectedEntry.service // Pass current service
        }));
        // Redirect to editor page
        router.push("/editor");
      } else {
        // Generate password based on decrypted settings
        const newPassword = generatePasswordFromSettings(decryptedSettings); // Use the generation function
        setGeneratedPassword(newPassword);
        setShowGeneratedPasswordModal(true); // Show the generated password modal
      }

    } catch (err) {
      // Provide more specific feedback if possible
      if (err instanceof SyntaxError || (err.message && err.message.includes("Malformed UTF-8")) || (err.message && err.message.includes("Decryption failed"))) {
          alert("Неверный мастер-пароль или данные повреждены.");
      } else {
          alert("Ошибка при расшифровке: " + err.message);
      }
      console.error("Error decrypting/using entry:", err);
      // Don't close modal on error, allow user to retry
      setMasterPassword(""); // Clear password field on error for retry
    }
  };

  // --- Filtering and Grouping Logic ---
  const filteredAndGroupedEntries = useMemo(() => {
    const filtered = entries.filter(entry => {
        const searchTermLower = searchTerm.toLowerCase();
        const nameMatch = entry.name?.toLowerCase().includes(searchTermLower);
        const serviceMatch = entry.service?.toLowerCase().includes(searchTermLower);
        return nameMatch || serviceMatch;
    });

    const groups = filtered.reduce((acc, entry) => {
      // Use a default category if service is missing or empty
      const serviceKey = entry.service || "Без категории";
      if (!acc[serviceKey]) {
        acc[serviceKey] = [];
      }
      acc[serviceKey].push(entry);
      return acc;
    }, {});

    // Sort groups alphabetically by service name
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    const sortedGroups = {};
    sortedGroupKeys.forEach(key => {
        // Sort entries within each group alphabetically by name
      sortedGroups[key] = groups[key].sort((a,b) => a.name.localeCompare(b.name));
    });

    return sortedGroups;
  }, [entries, searchTerm]);
  // --- End Filtering and Grouping ---


  if (loading) return <div className="container"><p>Загрузка сохраненных паролей...</p></div>;

  // --- Updated JSX ---
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
              placeholder="Поиск по названию или сервису..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {entries.length === 0 && !loading ? ( // Check entries length after loading
            <p>У вас пока нет сохраненных паролей</p>
          ) : Object.keys(filteredAndGroupedEntries).length === 0 && !loading && searchTerm ? ( // Check filtered results
            <p>Записи не найдены для "{searchTerm}"</p>
          ) : (
            <div className="entries-list">
              {Object.keys(filteredAndGroupedEntries).map(service => (
                <div key={service} className="entry-group">
                  <div className="service-name">{service}</div>
                  {filteredAndGroupedEntries[service].map(entry => (
                    <div key={entry._id} className="entry-item">
                      <div className="entry-info">
                        <div className="entry-name">{entry.name}</div>
                        {/* Additional info could be displayed here if needed */}
                      </div>
                      <div className="entry-actions">
                        <button
                          className="action-btn password-btn"
                          onClick={() => handleUseEntry(entry)} // Opens master pw modal
                          title="Получить пароль"
                        >
                          Пароль
                        </button>
                        <button
                          className="action-btn edit-btn"
                          onClick={() => handleUseEntry(entry)} // Opens master pw modal
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
        </div> {/* End card */}

        {/* Floating Action Button to add new entry */}
        <button
          className="fab-button"
          onClick={() => {
              // Clear any edit state before going to editor for a new entry
              localStorage.removeItem("passwordSettingsToEdit");
              router.push("/editor");
          }}
          title="Добавить новую запись"
        >
          +
        </button>

        {/* Modal for entering master password */}
        {showPasswordModal && selectedEntry && ( // Ensure selectedEntry exists
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Введите мастер-пароль</h2>
              <p>Для доступа к параметрам "{selectedEntry.name}" введите мастер-пароль:</p>

              <div className="form-group password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Мастер-пароль"
                  // Optional: Auto-focus or handle Enter key
                  autoFocus
                  onKeyPress={(e) => { if (e.key === 'Enter') decryptAndUse(false); }} // Example: Enter triggers "Show Password"
                />
                <button
                  type="button" // Prevent form submission if inside a form
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPassword ? "👁️‍🗨️" : "👁️"}
                </button>
              </div>

              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => {
                  setShowPasswordModal(false);
                  setMasterPassword("");
                  setShowPassword(false); // Reset toggle state on cancel
                }}>
                  Отмена
                </button>
                {/* Button to generate and show password */}
                <button className="confirm-btn" onClick={() => decryptAndUse(false)}>
                  Показать пароль
                </button>
                {/* Button to decrypt and go to editor */}
                <button className="edit-btn" onClick={() => decryptAndUse(true)}>
                  Редактировать
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for displaying the generated password */}
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
                    navigator.clipboard.writeText(generatedPassword)
                      .then(() => {
                           alert("Пароль скопирован в буфер обмена!");
                      })
                      .catch(err => {
                           console.error("Failed to copy password: ", err);
                           alert("Не удалось скопировать пароль.");
                      });
                  }}
                  title="Копировать пароль"
                >
                  ⧉
                </button>
              </div>

              <div className="modal-actions">
                <button className="confirm-btn" onClick={() => {
                  setShowGeneratedPasswordModal(false);
                  setGeneratedPassword(""); // Clear password after closing
                }}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </div> {/* End container */}
    </>
  );
  // --- End Updated JSX ---
}
// --- END OF FILE SavedPasswords.js ---