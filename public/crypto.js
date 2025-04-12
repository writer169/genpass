import CryptoJS from "crypto-js";
import { hash } from "./argon2"; // путь может отличаться

// Генерация ключа из мастер-фразы и соли
export async function deriveKey(masterPassword, salt) {
  const encoder = new TextEncoder();
  const hashBuffer = await hash({
    pass: encoder.encode(masterPassword),
    salt: encoder.encode(salt),
    time: 3,
    mem: 65536,
    hashLen: 32,
    parallelism: 1,
    type: 2, // argon2id
  });
  return CryptoJS.enc.Hex.parse(hashBuffer.encoded.substring(6, 70)); // вынимаем хеш
}

// Шифрование параметров
export async function encryptParams(params, masterPassword, salt) {
  const key = await deriveKey(masterPassword, salt);
  const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(params), key.toString()).toString();
  return ciphertext;
}

// Расшифровка параметров
export async function decryptParams(ciphertext, masterPassword, salt) {
  const key = await deriveKey(masterPassword, salt);
  const bytes = CryptoJS.AES.decrypt(ciphertext, key.toString());
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  return JSON.parse(decrypted);
}