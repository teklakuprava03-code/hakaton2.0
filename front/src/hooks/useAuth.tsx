// front/src/hooks/useAuth.tsx
import { createContext, useContext, useState, ReactNode } from "react";
import { apiPost } from "@/lib/api";

type User = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
};

type AuthContextType = {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  async function login(username: string, password: string) {
    const data = await apiPost<User>("/api/login/", { username, password });
    setUser(data);
  }

  async function logout() {
    // можно сделать /api/logout/ на бэке и дергать его здесь
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth должен вызываться внутри <AuthProvider>");
  }
  return ctx;
}