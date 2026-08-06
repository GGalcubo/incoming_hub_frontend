// Catálogos de producto y helpers de fecha. NO son datos de ejemplo: los estados
// son los que maneja el negocio (y con los que se traducen los del backend, ver
// api/viajes.ts) y las fechas son las que usan los atajos "Hoy / Mañana" de la
// lista.

import type { StatusMeta } from "../types/domain";

export const STATUSES: StatusMeta[] = [
  { id: "PENDIENTE", label: "Pendiente" },
  { id: "CONFIRMADO", label: "Confirmado" },
  { id: "EN_CURSO", label: "En curso" },
  { id: "FINALIZADO", label: "Finalizado" },
  { id: "CANCELADO", label: "Cancelado" },
  { id: "NO_SHOW", label: "No show" },
  { id: "REPROGRAMADO", label: "Reprogramado" },
  { id: "MODIFICADO", label: "Modificado" },
  { id: "EN_ESPERA", label: "En espera" },
];

const today = new Date();
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const TODAY = fmt(today);
export const TOMORROW = fmt(new Date(today.getTime() + 86400000));
