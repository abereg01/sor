const BASIC_B64_KEY = "keab_sor_basic_auth_b64";

export function loadBasicB64(): string | null {
  try {
    const v = localStorage.getItem(BASIC_B64_KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export function saveBasicB64(v: string | null) {
  try {
    if (!v) localStorage.removeItem(BASIC_B64_KEY);
    else localStorage.setItem(BASIC_B64_KEY, v);
  } catch {
  }
}
