import { useState } from "react";
import { useRouter } from "next/router";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.success) router.push("/");
    else setError("Неверный пароль");
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", textAlign: "center" }}>
      <h2>Вход</h2>
      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: 8, width: "100%" }}
      />
      <button style={{ marginTop: 12 }} onClick={handleLogin}>Войти</button>
      <p style={{ color: "red" }}>{error}</p>
    </div>
  );
}
