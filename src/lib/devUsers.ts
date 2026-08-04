// Usuarios preseteados para probar cada rol sin tener que tipear credenciales.
// Solo se muestran con `?admin=1` en la URL. A propósito NO se persiste: si se
// guardara, una sola visita con el parámetro los dejaría visibles para siempre.
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

export function devUsersEnabled(): boolean {
  try {
    // Limpieza de la versión anterior, que sí guardaba el flag: sin esto los
    // atajos siguen apareciendo en los navegadores que ya lo tenían escrito.
    localStorage.removeItem(FLAG_KEY);
    return new URLSearchParams(window.location.search).get(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}
