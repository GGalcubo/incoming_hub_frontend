import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { setOnUnauthorized } from "../api/client";
import { isExpired } from "../lib/jwt";
import type { User } from "../types/domain";

const STORAGE_KEY = "proxy:user";

function clearStored() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (!parsed.token || isExpired(parsed.token)) {
      clearStored();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface UserContextValue {
  user: User | null;
  login: (u: User, remember?: boolean) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);

  const value = useMemo<UserContextValue>(
    () => ({
      user,
      login: (u: User, remember = true) => {
        setUser(u);
        clearStored();
        const store = remember ? localStorage : sessionStorage;
        store.setItem(STORAGE_KEY, JSON.stringify(u));
      },
      logout: () => {
        setUser(null);
        clearStored();
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
