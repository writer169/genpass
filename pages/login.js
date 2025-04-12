import { useState } from "react";
import { useRouter } from "next/router";

export default function Вход() {
  const [пароль, setПароль] = useState("");
  const [ошибка, setОшибка] = useState("");
  const [загрузка, setЗагрузка] = useState(false);
  const маршрутизатор = useRouter();

  const обработатьОтправку = async (e) => {
    e.preventDefault();
    setОшибка("");
    setЗагрузка(true);

    try {
      const ответ = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: пароль }),
      });
      const данные = await ответ.json();

      if (данные.success) {
        маршрутизатор.push("/");
      } else {
        setОшибка("Неверный пароль");
      }
    } catch (err) {
      setОшибка("Произошла ошибка. Попробуйте снова.");
    } finally {
      setЗагрузка(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Вход
        </h2>
        <form onSubmit={обработатьОтправку}>
          <div className="mb-4">
            <label
              htmlFor="пароль"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Пароль
            </label>
            <input
              id="пароль"
              type="password"
              placeholder="Введите пароль"
              value={пароль}
              onChange={(e) => setПароль(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={загрузка}
            />
          </div>
          {ошибка && (
            <p className="text-red-500 text-sm mb-4 text-center">{ошибка}</p>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            disabled={загрузка}
          >
            {загрузка ? "Вход..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}