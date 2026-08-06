import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { StatusMeta, TripStatus } from "../types/domain";

// Catálogo de estados del backend (GET /estados/), compartido por toda la app vía
// react-query. Es lo que le da nombre y color a cada estado: el front ya no tiene
// una lista propia.
export interface UseEstados {
  estados: StatusMeta[];
  // Metadata de un estado por id. `undefined` mientras el catálogo carga o si el
  // viaje trae un estado que el catálogo no tiene (la UI cae al id crudo antes
  // que inventarle un nombre).
  metaOf: (id: TripStatus) => StatusMeta | undefined;
  // Id del estado con ese código, o null si el backend no lo tiene cargado. Lo
  // usan las acciones atadas a un estado concreto (finalizar, cancelar): si
  // devuelve null, la acción se deshabilita en vez de mandar otro estado.
  idPorCodigo: (codigo: string) => TripStatus | null;
  loading: boolean;
}

const norm = (s: string) => s.trim().toUpperCase();

export function useEstados(): UseEstados {
  const { data, isLoading } = useQuery({
    queryKey: ["estados"],
    queryFn: () => api.listEstados(),
    // El catálogo no cambia mientras se usa la app.
    staleTime: Infinity,
  });
  const estados = data ?? [];
  return {
    estados,
    metaOf: (id) => estados.find((e) => e.id === id),
    idPorCodigo: (codigo) => estados.find((e) => norm(e.codigo) === norm(codigo))?.id ?? null,
    loading: isLoading,
  };
}
