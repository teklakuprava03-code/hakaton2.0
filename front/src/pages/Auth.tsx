// front/src/pages/Auth.tsx (пример)
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function AuthPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
      // тут можно сделать navigate("/dashboard")
    } catch (err: any) {
      setError(err.message || "Ошибка входа");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Вход</h1>
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="space-y-1">
        <label className="block text-sm">Логин</label>
        <input
          className="border rounded px-2 py-1 w-full"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm">Пароль</label>
        <input
          type="password"
          className="border rounded px-2 py-1 w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Войти
      </button>
    </form>
  );
}