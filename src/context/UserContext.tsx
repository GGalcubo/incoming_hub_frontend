import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { setOnUnauthorized } from "../api/client";
import { isExpired } from "../lib/jwt";
import type { User } from "../types/domain";

const STORAGE_KEY = "proxy:user";

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (!parsed.token || isExpired(parsed.token)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface UserContextValue {
  user: User | null;
  login: (u: User) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);

  const value = useMemo<UserContextValue>(
    () => ({
      user,
      login: (u: User) => {
        setUser(u);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      },
      logout: () => {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [user],
  );

  useEffect(() => {
    setOnUnauthorized(value.logout);
  }, [value.logout]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser debe usarse dentro de <UserProvider>");
  return ctx;
}
