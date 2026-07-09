import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { MeProfile, RoleEnum } from "../api/backend";

// Perfil del usuario logueado, compartido por toda la app vía react-query (una
// sola request por sesión). Expone flags de rol para gatear navegación y vistas.
export interface UseMe {
  me: MeProfile | undefined;
  role: RoleEnum | null;
  isAdmin: boolean;
  isProvider: boolean;
  isAgency: boolean; // agency_staff | agency_operator (el "cliente")
  loading: boolean;
}

export function useMe(): UseMe {
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    staleTime: 5 * 60_000,
  });
  const role = data?.role ?? null;
  return {
    me: data,
    role,
    isAdmin: role === "admin",
    isProvider: role === "proveedor",
    isAgency: role === "agency_staff" || role === "agency_operator",
    loading: isLoading,
  };
}
