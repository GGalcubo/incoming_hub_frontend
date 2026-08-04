// Usuarios preseteados para probar cada rol sin tener que tipear credenciales.
// Solo se muestran cuando el navegador tiene el flag `admin=1`: se activa con
// `?admin=1` en la URL (queda guardado en localStorage) y se apaga con `?admin=0`.
const DEV_USERS_PASSWORD = "Basico2620";

export interface DevUser {
  user: string;
  pass: string;
  // Rol que le toca según `mockRoleFromUsername` (solo informativo, para la UI).
  label: string;
}

export const DEV_USERS: DevUser[] = [
  { user: "agencia1", pass: DEV_USERS_PASSWORD, label: "Agencia" },
  { user: "proveedor1", pass: DEV_USERS_PASSWORD, label: "Proveedor" },
  { user: "incomingAdmin", pass: DEV_USERS_PASSWORD, label: "Admin" },
];

const FLAG_KEY = "admin";

// `?admin=1` prende el flag y lo persiste; `?admin=0` lo apaga. Sin parámetro,
// vale lo último que quedó guardado.
export function devUsersEnabled(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get(FLAG_KEY);
    if (param !== null) {
      const on = param === "1" || param === "true";
      if (on) localStorage.setItem(FLAG_KEY, "1");
      else localStorage.removeItem(FLAG_KEY);
      return on;
    }
    return localStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}
