import { useCallback, useEffect, useMemo, useState } from "react";

import { loadBasicB64, saveBasicB64 } from "@/auth/storage";

export type Role = "admin" | "editor" | "viewer";

export type AuthState = {
  isAuthenticated: boolean;
  role: Role;
  basicB64: string | null;
};

export function useAuth() {
  const [basicB64, setBasicB64] = useState<string | null>(null);

  useEffect(() => {
    setBasicB64(loadBasicB64());
  }, []);

  const login = useCallback((nextBasicB64: string) => {
    const v = nextBasicB64.trim();
    saveBasicB64(v || null);
    setBasicB64(v || null);
  }, []);

  const logout = useCallback(() => {
    saveBasicB64(null);
    setBasicB64(null);
  }, []);

  const state: AuthState = useMemo(
    () => ({
      isAuthenticated: !!basicB64,
      role: "admin",
      basicB64,
    }),
    [basicB64]
  );

  return { state, login, logout };
}
